"""Diagnose one outage: what broke, how far it reached, and what it cost.

The outage log answers *when*. This answers *why it probably happened* and
*who it hurt*, from evidence the platform already collects — resource samples
either side of the gap, and the outage rows of every other router on the
account.

Two rules govern everything here:

* **Never assert what was not measured.** Where the evidence is missing the
  finding says so, rather than defaulting to a reassuring answer. "No samples
  bracket this outage" is a useful thing to read; a confident wrong cause is
  not, and an operator who is sent to the wrong site once stops reading these.
* **Deterministic first.** Every conclusion below is derived from stored
  numbers and can be checked by hand. The optional AI narrative sits on top of
  this evidence and never replaces it.
"""
from datetime import timedelta

from models import db, DeviceOutage, DeviceResourceSample, MikrotikDevice

# How far either side of the gap to look for a sample to compare against. Wide
# enough to survive a slow poll, narrow enough that the comparison still
# describes this outage rather than the state an hour later.
BRACKET_HOURS = 3
RECURRENCE_DAYS = 30


def _sample_before(device_id, moment):
    return (DeviceResourceSample.query
            .filter(DeviceResourceSample.device_id == device_id,
                    DeviceResourceSample.sampled_at <= moment,
                    DeviceResourceSample.sampled_at >= moment - timedelta(hours=BRACKET_HOURS))
            .order_by(DeviceResourceSample.sampled_at.desc())
            .first())


def _sample_after(device_id, moment):
    return (DeviceResourceSample.query
            .filter(DeviceResourceSample.device_id == device_id,
                    DeviceResourceSample.sampled_at >= moment,
                    DeviceResourceSample.sampled_at <= moment + timedelta(hours=BRACKET_HOURS))
            .order_by(DeviceResourceSample.sampled_at.asc())
            .first())


def _restart_check(outage, before, after):
    """Did the router restart during the gap?

    The test needs no trust in the *before* reading at all: if the uptime
    reported after the outage is smaller than the time elapsed between the two
    samples, the device cannot have been running for that whole span, so it
    restarted inside it. If it is larger, the device has been up continuously
    since before the outage began, so it did not.

    This is the single most useful thing on the page. A restart means power or
    a crash — a site visit to the PSU, the PoE injector, the mains. No restart
    means the router was alive and something between it and us disappeared —
    the uplink, the fibre, the tunnel. The two send an engineer to completely
    different places.
    """
    if not before or not after or before.uptime is None or after.uptime is None:
        return {'known': False, 'rebooted': None, 'elapsed_seconds': None,
                'uptime_after': None}
    elapsed = (after.sampled_at - before.sampled_at).total_seconds()
    return {
        'known': True,
        'rebooted': after.uptime < elapsed,
        'elapsed_seconds': int(elapsed),
        'uptime_after': int(after.uptime),
        'uptime_before': int(before.uptime) if before.uptime is not None else None,
    }


# How close two failures must start to count as the same event. Wide enough to
# absorb independent polling cycles, narrow enough to still mean "together".
TOGETHER_MINUTES = 15


def _concurrent(outage, isp_id, now):
    """Other routers overlapping this outage, split by what the overlap means.

    Plain overlap is not enough, and assuming it was produced a badly wrong
    answer on real data: a router that has been dead for two days overlaps
    *every* subsequent blip on every other router, so a 40-second tunnel drop
    was being reported as "all 4 routers went down together".

    So the two cases are separated, because they carry opposite conclusions:

    * **together** — started within TOGETHER_MINUTES of this one. A shared
      cause: transit, power, or the path back to this platform.
    * **already_down** — was down before this one began. Not evidence about
      *this* outage at all; it is context about the fleet being in a bad state.
    """
    end = outage.ended_at or now
    others = (DeviceOutage.query
              .filter(DeviceOutage.isp_id == isp_id,
                      DeviceOutage.device_id != outage.device_id,
                      DeviceOutage.started_at <= end)
              .filter(db.or_(DeviceOutage.ended_at.is_(None),
                             DeviceOutage.ended_at >= outage.started_at))
              .all())
    together, already = [], []
    for other in others:
        row = {
            'device_id': other.device_id,
            'device_name': getattr(other.device, 'device_name', f'Device {other.device_id}'),
            'started_at': other.started_at.isoformat() + 'Z',
            'ended_at': other.ended_at.isoformat() + 'Z' if other.ended_at else None,
            'minutes': other.duration_minutes(now),
        }
        drift = abs((other.started_at - outage.started_at).total_seconds()) / 60.0
        (together if drift <= TOGETHER_MINUTES else already).append(row)
    key = lambda r: r['started_at']
    return sorted(together, key=key), sorted(already, key=key)


def _pattern(outage, now):
    """How often this router does this, and whether it favours an hour."""
    since = outage.started_at - timedelta(days=RECURRENCE_DAYS)
    peers = (DeviceOutage.query
             .filter(DeviceOutage.device_id == outage.device_id,
                     DeviceOutage.started_at >= since,
                     DeviceOutage.started_at <= outage.started_at)
             .all())
    hour = outage.started_at.hour
    same_hour = [p for p in peers if abs(p.started_at.hour - hour) <= 1]
    previous = [p for p in peers if p.id != outage.id and p.started_at < outage.started_at]
    previous.sort(key=lambda p: p.started_at)
    gap = None
    if previous:
        last = previous[-1]
        gap = int(((outage.started_at - (last.ended_at or last.started_at)).total_seconds()) // 60)
    return {
        'window_days': RECURRENCE_DAYS,
        'outages_in_window': len(peers),
        'same_hour_count': len(same_hour),
        'hour': hour,
        'minutes_since_previous': gap if gap is None or gap >= 0 else 0,
    }


def analyse(outage, now=None):
    """Full diagnosis for one outage."""
    from datetime import datetime
    now = now or datetime.utcnow()
    device = outage.device or MikrotikDevice.query.get(outage.device_id)
    minutes = outage.duration_minutes(now)

    before = _sample_before(outage.device_id, outage.started_at)
    after = _sample_after(outage.device_id, outage.ended_at or now)
    restart = _restart_check(outage, before, after)
    concurrent, already_down = _concurrent(outage, outage.isp_id, now)
    fleet_total = MikrotikDevice.query.filter_by(isp_id=outage.isp_id, is_active=True).count()
    pattern = _pattern(outage, now)

    # Impact is taken from the router's OWN last reported client count rather
    # than from the session tables: radius_sessions is not populated on every
    # deployment, and an impact figure that silently reads zero because a table
    # is empty is worse than admitting the number is unknown.
    clients = before.client_count if before else None
    impact = {
        'clients_at_drop': clients,
        'clients_known': clients is not None,
        'subscriber_minutes': (clients * minutes) if clients else None,
        'sampled_at': before.sampled_at.isoformat() + 'Z' if before else None,
        'compensated_at': outage.compensated_at.isoformat() + 'Z' if outage.compensated_at else None,
        'compensated_customers': outage.compensated_customers or 0,
        'compensated_minutes': outage.compensated_minutes or 0,
    }

    resources = {
        'known': bool(before),
        'cpu_before': before.cpu_load if before else None,
        'memory_used_percent': (
            DeviceResourceSample._percent_used(before.mem_total, before.mem_free)
            if before else None),
        'sampled_at': before.sampled_at.isoformat() + 'Z' if before else None,
    }

    return {
        'outage': {
            'id': outage.id,
            'device_id': outage.device_id,
            'device_name': getattr(device, 'device_name', None),
            'started_at': outage.started_at.isoformat() + 'Z',
            'ended_at': outage.ended_at.isoformat() + 'Z' if outage.ended_at else None,
            'minutes': minutes,
            'open': outage.is_open,
        },
        'scope': {
            'concurrent': concurrent,
            'already_down': already_down,
            'fleet_total': fleet_total,
            'verdict': ('fleet' if fleet_total and len(concurrent) + 1 >= max(2, fleet_total)
                        else 'shared' if concurrent else 'isolated'),
        },
        'restart': restart,
        'resources': resources,
        'impact': impact,
        'pattern': pattern,
        'findings': _findings(outage, minutes, restart, concurrent, already_down,
                              fleet_total, resources, impact, pattern),
    }


def _findings(outage, minutes, restart, concurrent, already_down, fleet_total,
              resources, impact, pattern):
    """Plain-language conclusions, most decision-changing first."""
    out = []

    # 1. Scope first: it decides whether this router is even the suspect.
    if concurrent:
        names = ', '.join(sorted({c['device_name'] for c in concurrent}))
        shared = len(concurrent) + 1
        out.append({
            'tone': 'critical' if shared >= max(2, fleet_total) else 'serious',
            'title': (f'All {shared} routers were down together'
                      if fleet_total and shared >= fleet_total
                      else f'{shared} routers were down together'),
            'text': (f'{names} {"was" if len(concurrent) == 1 else "were"} offline in the same window. '
                     'When routers at different points fail together the cause is almost never any one '
                     'of them — look upstream first: the transit link, the power feed they share, or '
                     'the path back to this platform.'),
        })
    elif already_down:
        names = ', '.join(sorted({c['device_name'] for c in already_down}))
        out.append({
            'tone': 'note',
            'title': f'{len(already_down)} other router(s) were already offline',
            'text': (f'{names} had already been down for some time when this outage began, so they are '
                     'not evidence of a shared cause here — but a fleet in that state is worth dealing '
                     'with in its own right.'),
        })
    else:
        out.append({
            'tone': 'note',
            'title': 'Only this router was affected',
            'text': ('No other router on the account failed alongside this one, so the fault is local to '
                     'this site rather than upstream.'),
        })

    # 2. Restart or not — the single most directing piece of evidence.
    if restart.get('known'):
        if restart['rebooted']:
            out.append({
                'tone': 'serious',
                'title': 'The router restarted',
                'text': (f'It reported {restart["uptime_after"] // 60} minutes of uptime after the outage, '
                         f'less than the {restart["elapsed_seconds"] // 60} minutes between the readings '
                         'either side — so it cannot have been running throughout, and must have '
                         'restarted. That is power or a crash, not a link fault: check the mains, the '
                         'PSU and the PoE injector at the site before touching configuration.'),
            })
        else:
            out.append({
                'tone': 'warning',
                'title': 'The router never restarted',
                'text': ('Its uptime counter ran straight through the outage, so the device itself stayed '
                         'powered and running the whole time. Something between it and this platform went '
                         'away instead — the uplink, the fibre, or the management tunnel. Checking the '
                         'router will find nothing wrong with it.'),
            })
    else:
        out.append({
            'tone': 'note',
            'title': 'Cannot tell whether it restarted',
            'text': ('No resource readings bracket this outage, so there is no uptime to compare. That '
                     'usually means the outage is older than the sample retention, or polling was not '
                     'running at the time.'),
        })

    # 3. Was it already struggling?
    cpu = resources.get('cpu_before')
    if cpu is not None and cpu >= 80:
        out.append({
            'tone': 'warning',
            'title': f'CPU was at {cpu:.0f}% just before it dropped',
            'text': ('The router was already under load when it went. Sustained high CPU on a MikroTik '
                     'usually means traffic is taking the firewall path rather than being fast-tracked — '
                     'per-connection load balancing does exactly that.'),
        })

    # 4. The damage.
    if impact['clients_known'] and impact['clients_at_drop']:
        out.append({
            'tone': 'warning',
            'title': f'{impact["clients_at_drop"]} connected clients were cut off',
            'text': (f'That is what the router last reported before the drop, so roughly '
                     f'{impact["subscriber_minutes"]} subscriber-minutes of service were lost across '
                     f'{minutes} minutes of downtime.'
                     + ('' if impact['compensated_at'] else
                        ' No compensation has been recorded against this outage.')),
        })
    elif impact['clients_known']:
        out.append({
            'tone': 'good',
            'title': 'No clients were connected',
            'text': ('The router reported zero connected clients just before it dropped, so this outage '
                     'most likely cost no subscriber any service.'),
        })

    # 5. Is this a habit?
    if pattern['outages_in_window'] >= 5:
        out.append({
            'tone': 'serious',
            'title': f'{pattern["outages_in_window"]} outages in {pattern["window_days"]} days',
            'text': (f'{pattern["same_hour_count"]} of them began within an hour of '
                     f'{pattern["hour"]:02d}:00. Repetition at one time of day points at something '
                     'scheduled — a generator changeover, a thermal peak, a backup window — rather than '
                     'a random fault.'
                     if pattern['same_hour_count'] >= 3 else
                     'This router fails often enough that the pattern matters more than any single '
                     'outage. Treat it as one recurring fault, not a series of unrelated ones.'),
        })

    return out
