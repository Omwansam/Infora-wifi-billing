#!/usr/bin/env python3
"""Generate a realistic "someone else's billing system" router, for lab testing.

Produces two files from one roster, so the takeover flow can be exercised with
or without hardware:

* ``incumbent-build.rsc``  — paste into a **spare** router's terminal to make it
  look like a live Centipede-managed ISP. Then take a real ``/export
  show-sensitive`` off it and upload that, which tests the true path end to end.
* ``incumbent-export.rsc`` — already in ``/export`` shape, so the import wizard
  can be driven today with no router at all.

The roster is deliberately awkward in the ways real ones are, because a fixture
that is uniformly tidy tests nothing:

* asymmetric rate limits (a ``3M/10M`` profile is a 10 Mbps *download* service —
  emitted backwards, every imported client gets the wrong speed);
* a burst profile, and a profile with **no** rate limit that must not become a
  0 Mbps package;
* comments in five different operator dialects, including a bare date that must
  **not** be mined as an expiry (it is as likely a join date, and guessing wrong
  disconnects someone);
* disabled secrets, which must import suspended and with no RADIUS rows;
* static-IP secrets, MAC-only hotspot users, and RouterOS's stock
  ``default-trial`` entry, which must be excluded from the roster;
* queue-billed clients, which are explicitly out of scope and must be reported
  rather than silently imported;
* a password containing a space, which a naive parser truncates.

Usage:  python3 config/lab/make_incumbent.py [--count 34] [--out config/lab]

NOTE: every credential in here is invented for testing. Do not run the build
script against a router carrying real subscribers — it adds PPPoE profiles,
secrets, a hotspot and firewall rules.
"""
import argparse
import os
import random

# --- The incumbent's packages -------------------------------------------
# (name, rate-limit, monthly price the operator charges — for the pricing step)
PROFILES = [
    ('HOME-2M',  '2M/2M',                                    1500),
    ('HOME-5M',  '5M/5M',                                    2500),
    # Asymmetric on purpose: 10 Mbps down, 3 up. rx/tx is from the CLIENT's
    # point of view, so rx=upload and tx=download.
    ('HOME-10M', '3M/10M',                                   3500),
    # Burst, because plenty of real profiles carry one.
    ('BIZ-20M',  '10M/20M 12M/24M 8M/16M 30/30 8',           9000),
]
# A profile with no rate limit at all. Must be recognised as "no package",
# never imported as a 0 Mbps one.
UNLIMITED_PROFILE = 'staff-unmetered'

FIRST = ['John', 'Mary', 'Peter', 'Grace', 'Samuel', 'Faith', 'Daniel', 'Esther',
         'Joseph', 'Ruth', 'David', 'Alice', 'Brian', 'Caroline', 'Kevin',
         'Lucy', 'Dennis', 'Nancy', 'Felix', 'Beatrice', 'Collins', 'Janet',
         'Moses', 'Purity', 'Erick', 'Winnie', 'Simon', 'Rose', 'Antony',
         'Mercy', 'Victor', 'Sharon', 'Patrick', 'Joyce']
LAST = ['Mwangi', 'Wanjiku', 'Otieno', 'Njoroge', 'Achieng', 'Kamau', 'Wafula',
        'Chebet', 'Mutua', 'Adhiambo', 'Kiprop', 'Nyambura', 'Omondi', 'Wairimu',
        'Barasa', 'Cherono', 'Maina', 'Akinyi', 'Kipchoge', 'Wangari']

# Five dialects, because operators do not agree on a format and the miner has
# to cope with all of them. `%(bare)s` carries a date with NO keyword in front
# of it — that one must come back expiry_is_explicit=False.
COMMENT_STYLES = [
    '{name} {phone} exp {date_iso}',
    '{name} | {phone} | due {date_slash}',
    '{name} {phone} paid till {date_word}',
    '{name} - {phone}',
    '{name} {phone} {date_iso}',
]


def _password(rng):
    """Passwords in the shapes people really use, including the awkward ones."""
    shapes = [
        lambda: f'{rng.choice(["net", "wifi", "fiber"])}{rng.randint(1000, 9999)}',
        lambda: f'{rng.choice(FIRST).lower()}{rng.randint(10, 99)}',
        lambda: f'{rng.randint(100000, 999999)}',
        # A space, and a symbol: both truncate or break a naive parser.
        lambda: f'{rng.choice(["blue", "green"])} {rng.randint(100, 999)}',
        lambda: f'p@ss{rng.randint(100, 999)}!',
    ]
    return rng.choice(shapes)()


def build_roster(count, seed=20260824):
    rng = random.Random(seed)
    used_logins = set()
    roster = []
    for index in range(count):
        first, last = rng.choice(FIRST), rng.choice(LAST)
        name = f'{first} {last}'
        phone = f'07{rng.choice("0123489")}{rng.randint(1000000, 9999999)}'[:10]

        # Three login conventions, all of which appear in real exports.
        style = rng.random()
        if style < 0.45:
            login = f'acct_{1000 + index}'
        elif style < 0.8:
            login = f'{first.lower()}.{last.lower()}'
        else:
            login = phone
        while login in used_logins:
            login = f'{login}{rng.randint(1, 9)}'
        used_logins.add(login)

        profile, _rate, _price = rng.choice(PROFILES)
        day = rng.randint(1, 28)
        month = rng.choice([9, 10])
        comment = rng.choice(COMMENT_STYLES).format(
            name=name, phone=phone,
            date_iso=f'2026-{month:02d}-{day:02d}',
            date_slash=f'{day}/{month}/2026',
            date_word=f'{day} {["Sep", "Oct"][month - 9]} 2026',
        )
        roster.append({
            'login': login,
            'password': _password(rng),
            'profile': profile,
            'comment': comment,
            # Roughly one in nine is suspended for non-payment, as usual.
            'disabled': index % 9 == 4,
            # A few have a static IP the operator hand-assigned.
            'static_ip': f'10.20.30.{100 + index}' if index % 11 == 3 else None,
        })
    # One staff account on the unmetered profile, and one blank-comment account.
    roster.append({'login': 'noc.staff', 'password': 'noc 4477', 'profile': UNLIMITED_PROFILE,
                   'comment': 'NOC laptop - do not bill', 'disabled': False, 'static_ip': None})
    roster.append({'login': 'acct_9001', 'password': 'fiber2211', 'profile': 'HOME-5M',
                   'comment': '', 'disabled': False, 'static_ip': None})
    return roster


HOTSPOT_USERS = [
    ('kiosk01', 'kiosk123', 'HS-DAY', 'Cyber kiosk Ruiru 0722004455 exp 2026-09-30'),
    ('kiosk02', 'kiosk456', 'HS-DAY', 'Cyber kiosk Kimbo 0733005566'),
    ('lodge-wifi', 'lodge2026', 'HS-WEEK', 'Green Lodge 0711223344 due 20/09/2026'),
    ('salon01', 'salon77', 'HS-DAY', 'Beauty Spot 0700998877'),
    ('church-hall', 'hall 2026', 'HS-WEEK', 'St Marks hall 0722334455 paid till 5 Oct 2026'),
]

QUEUE_CLIENTS = [
    ('shop-corner', '10.20.40.11/32', '4M/4M', 'Corner shop static 0722667788 exp 2026-09-18'),
    ('flats-blockB', '10.20.40.12/32', '8M/8M', 'Block B landlord 0733778899'),
    ('school-lab', '10.20.40.13/32', '15M/15M', 'Ruiru school lab due 1/10/2026'),
]


def build_script(roster):
    """RouterOS commands that turn a spare router into the fake incumbent."""
    out = [
        '# ============================================================',
        '# LAB FIXTURE — a spare router dressed as a Centipede-managed ISP.',
        '# Invented subscribers and invented passwords. Do NOT paste this',
        '# into a router that carries real customers.',
        '# ============================================================',
        '',
        '# --- The incumbent\'s packages ---',
    ]
    for name, rate, _price in PROFILES:
        # Quoted: the burst form contains spaces, which would otherwise end
        # the value and leave RouterOS parsing '12M/24M' as a command.
        out.append(f'/ppp profile add name={name} local-address=10.20.30.1 '
                   f'remote-address=lab-pppoe-pool rate-limit="{rate}"')
    out.append(f'/ppp profile add name={UNLIMITED_PROFILE} local-address=10.20.30.1 '
               f'remote-address=lab-pppoe-pool')
    out += [
        '',
        '# --- Address plan ---',
        '/ip pool add name=lab-pppoe-pool ranges=10.20.30.10-10.20.30.254',
        '/ip pool add name=lab-hotspot-pool ranges=10.20.50.10-10.20.50.254',
        '/interface pppoe-server server add service-name=lab-isp interface=ether2 '
        'default-profile=HOME-5M disabled=no',
        '',
        f'# --- {len(roster)} subscribers ---',
    ]
    for row in roster:
        parts = [f'/ppp secret add name="{row["login"]}"',
                 f'password="{row["password"]}"',
                 f'profile={row["profile"]}', 'service=pppoe']
        if row['static_ip']:
            parts.append(f'remote-address={row["static_ip"]}')
        if row['disabled']:
            parts.append('disabled=yes')
        if row['comment']:
            parts.append(f'comment="{row["comment"]}"')
        out.append(' '.join(parts))

    out += [
        '',
        '# --- Hotspot side ---',
        '/ip hotspot user profile add name=HS-DAY rate-limit=3M/3M shared-users=2',
        '/ip hotspot user profile add name=HS-WEEK rate-limit=5M/5M shared-users=4',
    ]
    for name, password, profile, comment in HOTSPOT_USERS:
        out.append(f'/ip hotspot user add name="{name}" password="{password}" '
                   f'profile={profile} comment="{comment}"')
    out.append('# A MAC-only hotspot user: no password, and that is not a fault.')
    out.append('/ip hotspot user add mac-address=AA:BB:CC:11:22:33 profile=HS-DAY '
               'comment="Reception tablet"')

    out += [
        '',
        '# --- Static / queue-billed clients (out of scope for import v1) ---',
    ]
    for name, target, rate, comment in QUEUE_CLIENTS:
        out.append(f'/queue simple add name="{name}" target={target} '
                   f'max-limit={rate} comment="{comment}"')

    out += [
        '',
        '# --- Incumbent fingerprints: what betrays the old system ---',
        '/system script add name="centipede-sync" source=":log info \\"centipede sync\\""',
        '/system scheduler add name="centipede-expiry" interval=1d start-time=00:05 '
        'on-event="/ppp secret set [find comment~\\"exp\\"] disabled=yes" '
        'comment="centipede nightly expiry sweep"',
        '',
        '# The old RADIUS server, left DISABLED so the scan reports auth_mode=local',
        '# (the zero-touch path). Enable it to see the hybrid path instead:',
        '#   /radius enable [find comment~"centipede"]',
        '/radius add address=192.168.88.250 secret=centipede-secret service=ppp '
        'comment="centipede radius" disabled=yes',
        '',
        '# FastTrack present, so the scan flags that accounting would read zero.',
        '/ip firewall filter add chain=forward action=fasttrack-connection '
        'connection-state=established,related comment="defconf: fasttrack"',
        '',
        ':put "Lab incumbent built. Now run: /export show-sensitive"',
    ]
    return '\n'.join(out) + '\n'


def build_export(roster):
    """The same roster already in ``/export`` shape — no router required."""
    out = [
        '# 2026-08-24 10:15:42 by RouterOS 7.14.3',
        '# software id = LAB0-TEST',
        '#',
        '# model = RB3011UiAS',
        '# serial number = LAB000000001',
        '/interface bridge',
        'add name=bridge-lan',
        '/ip pool',
        'add name=lab-pppoe-pool ranges=10.20.30.10-10.20.30.254',
        'add name=lab-hotspot-pool ranges=10.20.50.10-10.20.50.254',
        '/ppp profile',
        # RouterOS exports the stock profiles as `set`, not `add`.
        'set *0 name=default',
        'set *FFFFFFFE name=default-encryption',
    ]
    for name, rate, _price in PROFILES:
        out.append(f'add local-address=10.20.30.1 name={name} '
                   f'rate-limit="{rate}" remote-address=lab-pppoe-pool')
    out.append(f'add local-address=10.20.30.1 name={UNLIMITED_PROFILE} '
               f'remote-address=lab-pppoe-pool')

    out.append('/ip hotspot user profile')
    out.append('set [ find default=yes ] name=default')
    out.append('add name=HS-DAY rate-limit=3M/3M shared-users=2')
    out.append('add name=HS-WEEK rate-limit=5M/5M shared-users=4')

    out.append('/ppp secret')
    for row in roster:
        parts = [f'add name="{row["login"]}"', f'password="{row["password"]}"',
                 f'profile={row["profile"]}', 'service=pppoe']
        if row['static_ip']:
            parts.append(f'remote-address={row["static_ip"]}')
        if row['disabled']:
            parts.append('disabled=yes')
        if row['comment']:
            parts.append(f'comment="{row["comment"]}"')
        out.append(' '.join(parts))

    out.append('/ip hotspot user')
    # RouterOS's own entry. Excluded from the roster as a built-in — counting it
    # once made an empty router report a phantom subscriber.
    out.append('add name=default-trial profile=default')
    for name, password, profile, comment in HOTSPOT_USERS:
        out.append(f'add name="{name}" password="{password}" profile={profile} '
                   f'comment="{comment}"')
    out.append('add mac-address=AA:BB:CC:11:22:33 profile=HS-DAY comment="Reception tablet"')

    out.append('/queue simple')
    for name, target, rate, comment in QUEUE_CLIENTS:
        out.append(f'add max-limit={rate} name="{name}" target={target} comment="{comment}"')

    out += [
        '/interface pppoe-server server',
        'add default-profile=HOME-5M disabled=no interface=ether2 service-name=lab-isp',
        '/system script',
        'add name=centipede-sync source=":log info \\"centipede sync\\""',
        '/system scheduler',
        'add interval=1d name=centipede-expiry on-event="/ppp secret set [find comment~\\"exp\\"] '
        'disabled=yes" start-time=00:05 comment="centipede nightly expiry sweep"',
        '/radius',
        'add address=192.168.88.250 comment="centipede radius" disabled=yes secret=centipede-secret '
        'service=ppp',
        '/ppp aaa',
        'set accounting=yes use-radius=no',
        '/ip firewall filter',
        'add action=fasttrack-connection chain=forward comment="defconf: fasttrack" '
        'connection-state=established,related',
        '/system identity',
        'set name=RUIRU-CORE-01',
    ]
    return '\n'.join(out) + '\n'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--count', type=int, default=34, help='PPPoE subscribers to invent')
    parser.add_argument('--out', default=os.path.dirname(os.path.abspath(__file__)))
    args = parser.parse_args()

    roster = build_roster(args.count)
    targets = {
        'incumbent-build.rsc': build_script(roster),
        'incumbent-export.rsc': build_export(roster),
    }
    for name, content in targets.items():
        path = os.path.join(args.out, name)
        with open(path, 'w', encoding='utf-8') as handle:
            handle.write(content)
        print(f'{path}  ({len(content.splitlines())} lines)')

    print(f'\n{len(roster)} PPPoE secrets '
          f'({sum(1 for r in roster if r["disabled"])} disabled, '
          f'{sum(1 for r in roster if r["static_ip"])} static-IP), '
          f'{len(HOTSPOT_USERS)} hotspot users + 1 MAC-only, '
          f'{len(QUEUE_CLIENTS)} queue-billed, {len(PROFILES)} priced profiles '
          f'+ 1 unmetered.')


if __name__ == '__main__':
    main()
