"""Why can't a CPE reach the ACS?

The ACS path has more hops than it looks, and every one of them is invisible from
the console:

    CPE (172.31.x, PPPoE)
      -> managed MikroTik: route 10.250.0.1/32 via wg-mgmt, srcnat masquerade
      -> WireGuard: source must fall inside the peer's allowed-ips, or the packet
         is dropped by cryptokey routing before any firewall sees it
      -> wireguard container: DNAT 10.250.0.1:7547 -> flask_app:5000
      -> Flask /tr069

Establishing this by hand means SSHing to a router, reading iptables inside another
container, and reasoning about masquerade — roughly twenty steps, most of which the
console cannot show. This module does it in one call and returns the same
``{checks, verdict}`` shape as ``device_diagnostics``, so the CLI printer and the UI
renderer written for `diagnose-device` work unchanged.

Deliberately not checked: the wireguard container's iptables. Flask cannot read
another container's netfilter tables, and shelling into it from here would couple the
app to the compose topology. The router-side fetch probe covers it end to end
instead — a stale DNAT makes that fetch fail, which is the symptom that matters.
"""
from urllib.parse import urlparse

from flask import current_app

from models import CpeDevice, MikrotikDevice
from services.device_diagnostics import _check, _mgmt_subnet


def _acs_url():
    return (current_app.config.get('TR069_ACS_URL') or '').strip()


def _diagnose_config():
    """Is the ACS configured at all, and is it the tunnel form?"""
    from services.tr069 import enrollment

    url = _acs_url()
    checks = [_check(
        'acs_url_set', 'TR069_ACS_URL is configured', bool(url),
        f'ACS URL: {url}' if url else
        'Unset — the console cannot tell an operator what to type into a CPE, and '
        'DEPLOYMENT.md Appendix A must NOT be followed to "fix" this by blanking it.',
    )]

    if url:
        tunnel_only = enrollment.acs_is_tunnel_only(url)
        host = urlparse(url).hostname or '?'
        checks.append(_check(
            'acs_url_tunnel', 'ACS URL is on the management tunnel', tunnel_only,
            f'{host} is inside {_mgmt_subnet()} — no internet exposure' if tunnel_only
            else f'{host} is outside {_mgmt_subnet()}. Valid for CPE that are not '
                 'behind a managed router, but it puts CWMP on the public internet '
                 'and disables enrolment windows.',
            severity='warn',
        ))
    return checks


def _diagnose_acs_app():
    """Does this Flask actually serve /tr069? Cheap, catches a blueprint regression."""
    rules = {str(r.rule) for r in current_app.url_map.iter_rules()}
    served = '/tr069' in rules or '/tr069/' in rules
    return [_check(
        'acs_route', 'Flask serves the /tr069 endpoint', served,
        '' if served else 'The tr069 blueprint is not registered — no CPE can inform.',
    )]


def _diagnose_router(device, probe=False):
    """Per-router: is the tunnel up, and is the CPE->ACS path configured on it?"""
    from services.device_config_ops import DeviceBusy, mikrotik_ssh, probe_tunnel

    label = f'{device.device_name} (id={device.id})'
    if not (device.management_wg_enabled and device.management_wg_ip):
        return [_check(
            f'router_{device.id}_tunnel', f'{label}: has a management tunnel', False,
            'No management tunnel — CPE behind this router cannot reach the ACS at all.',
            severity='warn',
        )]

    result = probe_tunnel(device, timeout=2, attempts=3)
    checks = [_check(
        f'router_{device.id}_tunnel', f'{label}: answers on the tunnel', result['up'],
        result['detail'],
        severity='warn',
    )]
    if not result['up']:
        return checks

    server_ip = current_app.config.get('WIREGUARD_MGMT_SERVER_IP', '10.250.0.1')
    try:
        with mikrotik_ssh(device, timeout=15, lock_wait=5, retries=1) as client:
            routes, _ = client.run_cli(
                f'/ip route print terse where gateway=wg-mgmt')
            nat, _ = client.run_cli(
                '/ip firewall nat print terse where chain=srcnat action=masquerade')
            fetched = None
            if probe:
                # The end-to-end proof: reaches Flask only if the route, the
                # masquerade, WireGuard's allowed-ips and the container DNAT all
                # line up.
                #
                # `:put [...]` is load-bearing. A bare `as-value` fetch prints
                # nothing at all over SSH, and plain `output=user` prints only a
                # progress table; wrapping it returns a parseable value map
                # (`status=finished;code=200;data=...`) and keeps the response off
                # the router's filesystem, which dst-path would not.
                fetched, _ = client.run_cli(
                    f':put [/tool fetch url="http://{server_ip}:7547/tr069" '
                    'http-method=get output=user as-value]'
                )
    except DeviceBusy:
        checks.append(_check(
            f'router_{device.id}_config', f'{label}: CPE->ACS path', False,
            'Skipped — router busy with another session', severity='warn',
        ))
        return checks
    except Exception as exc:
        checks.append(_check(
            f'router_{device.id}_config', f'{label}: CPE->ACS path', False,
            f'Could not read the router config: {exc}', severity='warn',
        ))
        return checks

    has_route = server_ip in (routes or '')
    checks.append(_check(
        f'router_{device.id}_route', f'{label}: routes {server_ip} via wg-mgmt', has_route,
        '' if has_route else
        f'No route for {server_ip} — re-provision the router (the rule is tagged '
        '"infora-radius-via-tunnel" and carries ACS traffic too).',
        severity='warn',
    ))

    has_masq = 'masquerade' in (nat or '').lower()
    checks.append(_check(
        f'router_{device.id}_masq', f'{label}: srcnat masquerade present', has_masq,
        'CPE traffic leaves as the router\'s tunnel address, which is what '
        "WireGuard's allowed-ips requires" if has_masq else
        'Without it, CPE packets keep their 172.x source and WireGuard drops them '
        'at the far end — allowed-ips only covers the tunnel address.',
        severity='warn',
    ))

    if probe:
        body = fetched or ''
        # Insist on our own greeting, not merely a 200: anything else answering on
        # that address means the DNAT is pointing somewhere unexpected.
        from routes.tr069 import GET_GREETING
        ok = ('status=finished' in body and 'code=200' in body
              and GET_GREETING.strip()[:20] in body)
        checks.append(_check(
            f'router_{device.id}_fetch', f'{label}: ACS answers over the tunnel', ok,
            f'Fetched http://{server_ip}:7547/tr069 and got the ACS greeting' if ok else
            f'The router could not reach the ACS. Router said: {body.strip()[:160] or "(no output)"}. '
            'This is the check that catches a stale DNAT in the wireguard container '
            'after flask_app was recreated.',
        ))
    return checks


def diagnose_acs(probe=False):
    """Run every layer and return a structured report.

    ``probe`` adds a live fetch from each router — accurate but slow, since router
    SSH runs to tens of seconds, so it is opt-in.
    """
    checks = _diagnose_config() + _diagnose_acs_app()

    routers = MikrotikDevice.query.filter_by(management_wg_enabled=True).all()
    if not routers:
        checks.append(_check(
            'routers_present', 'At least one router carries the tunnel', False,
            'No device has a management tunnel, so no CPE has a path to the ACS.',
        ))
    for device in routers:
        checks += _diagnose_router(device, probe=probe)

    cpe_total = CpeDevice.query.count()
    checks.append(_check(
        'cpe_seen', 'A CPE has informed at least once', cpe_total > 0,
        f'{cpe_total} CPE known to the ACS' if cpe_total else
        'No CPE has ever informed. The ACS answering is necessary but not '
        'sufficient: something must still put the ACS URL into a device. PPPoE '
        'carries no DHCP option 43, so that is manual entry or OMCI — see TR069.md.',
        severity='warn',
    ))

    blocking = [c for c in checks if not c['ok'] and c['severity'] == 'error']
    warnings = [c for c in checks if not c['ok'] and c['severity'] == 'warn']

    if blocking:
        verdict = f"Blocked at: {blocking[0]['label']}."
    elif not _acs_url():
        verdict = 'ACS is not configured.'
    elif warnings:
        verdict = (
            f'ACS is serving, with {len(warnings)} warning(s) — '
            f"first: {warnings[0]['label']}."
        )
    else:
        verdict = 'ACS is reachable and every router carries a path to it.'

    return {
        'acs_url': _acs_url() or None,
        'probed': bool(probe),
        'cpe_count': cpe_total,
        'checks': checks,
        'verdict': verdict,
    }
