"""Phone normalisation and the country table behind the signup selects.

One table, one owner. The signup wizard's country-code picker, timezone default
and billing-currency default all read from ``COUNTRIES`` here via
``GET /api/onboarding/countries`` rather than keeping a parallel copy in the
frontend — a dial code that disagrees between client and server produces an OTP
sent to the wrong number, which is invisible until a user complains.

Normalisation is deliberately simple (strip, drop the national trunk prefix,
prepend the dial code) rather than a full libphonenumber dependency: the failure
mode we must avoid is *accepting* a malformed number, and length bounds catch
that. A number that normalises cleanly but does not exist still fails at the
OTP step, where the user can correct it.
"""
from __future__ import annotations

import re

# code -> (name, dial code, default IANA timezone, default ISO-4217 currency)
# Ordered so the East African markets we sell into surface first in the picker.
COUNTRIES = [
    ('KE', 'Kenya',              '254', 'Africa/Nairobi',     'KES'),
    ('UG', 'Uganda',             '256', 'Africa/Kampala',     'UGX'),
    ('TZ', 'Tanzania',           '255', 'Africa/Dar_es_Salaam', 'TZS'),
    ('RW', 'Rwanda',             '250', 'Africa/Kigali',      'RWF'),
    ('BI', 'Burundi',            '257', 'Africa/Bujumbura',   'BIF'),
    ('SS', 'South Sudan',        '211', 'Africa/Juba',        'SSP'),
    ('ET', 'Ethiopia',           '251', 'Africa/Addis_Ababa', 'ETB'),
    ('SO', 'Somalia',            '252', 'Africa/Mogadishu',   'SOS'),
    ('NG', 'Nigeria',            '234', 'Africa/Lagos',       'NGN'),
    ('GH', 'Ghana',              '233', 'Africa/Accra',       'GHS'),
    ('ZA', 'South Africa',        '27', 'Africa/Johannesburg', 'ZAR'),
    ('ZM', 'Zambia',             '260', 'Africa/Lusaka',      'ZMW'),
    ('ZW', 'Zimbabwe',           '263', 'Africa/Harare',      'USD'),
    ('MW', 'Malawi',             '265', 'Africa/Blantyre',    'MWK'),
    ('MZ', 'Mozambique',         '258', 'Africa/Maputo',      'MZN'),
    ('BW', 'Botswana',           '267', 'Africa/Gaborone',    'BWP'),
    ('NA', 'Namibia',            '264', 'Africa/Windhoek',    'NAD'),
    ('CM', 'Cameroon',           '237', 'Africa/Douala',      'XAF'),
    ('CI', "Côte d'Ivoire",      '225', 'Africa/Abidjan',     'XOF'),
    ('SN', 'Senegal',            '221', 'Africa/Dakar',       'XOF'),
    ('EG', 'Egypt',               '20', 'Africa/Cairo',       'EGP'),
    ('MA', 'Morocco',            '212', 'Africa/Casablanca',  'MAD'),
    ('GB', 'United Kingdom',      '44', 'Europe/London',      'GBP'),
    ('US', 'United States',        '1', 'America/New_York',   'USD'),
    ('CA', 'Canada',               '1', 'America/Toronto',    'CAD'),
    ('IN', 'India',               '91', 'Asia/Kolkata',       'INR'),
    ('PK', 'Pakistan',            '92', 'Asia/Karachi',       'PKR'),
    ('BD', 'Bangladesh',         '880', 'Asia/Dhaka',         'BDT'),
    ('AE', 'United Arab Emirates', '971', 'Asia/Dubai',       'AED'),
    ('PH', 'Philippines',         '63', 'Asia/Manila',        'PHP'),
    ('ID', 'Indonesia',           '62', 'Asia/Jakarta',       'IDR'),
    ('BR', 'Brazil',              '55', 'America/Sao_Paulo',  'BRL'),
    ('AU', 'Australia',           '61', 'Australia/Sydney',   'AUD'),
]

DEFAULT_COUNTRY = 'KE'

_BY_CODE = {code: (name, dial, tz, cur) for code, name, dial, tz, cur in COUNTRIES}

# Longest dial code is 3 digits + up to 12 national digits. E.164 caps at 15.
_E164_RE = re.compile(r'^\+[1-9]\d{7,14}$')


class InvalidPhone(ValueError):
    """The supplied number cannot be turned into a valid E.164 number."""


def country_choices():
    """Serialisable country table for the signup selects."""
    return [
        {
            'code': code,
            'name': name,
            'dial_code': f'+{dial}',
            'timezone': tz,
            'currency': currency,
        }
        for code, name, dial, tz, currency in COUNTRIES
    ]


def country_defaults(code):
    """(timezone, currency) for an ISO country code, falling back to the default."""
    entry = _BY_CODE.get((code or '').upper()) or _BY_CODE[DEFAULT_COUNTRY]
    return entry[2], entry[3]


def is_known_country(code):
    return (code or '').upper() in _BY_CODE


def dial_code_for(country):
    entry = _BY_CODE.get((country or '').upper())
    return f'+{entry[1]}' if entry else None


def normalize_phone(raw, country=DEFAULT_COUNTRY):
    """Return ``raw`` as an E.164 string, or raise :class:`InvalidPhone`.

    Accepts what people actually type: ``0712 345 678``, ``712-345-678``,
    ``+254712345678``, ``254712345678``. The leading ``0`` is a national trunk
    prefix, not part of the number, so it is dropped before the dial code goes on.
    """
    supplied = str(raw or '').strip()
    digits = re.sub(r'[^\d+]', '', supplied)
    if not digits:
        # Distinguish "you left it blank" from "what you typed has no digits" —
        # telling someone who typed `abc` to "enter your number" reads as though
        # the field never received it.
        raise InvalidPhone(
            'Enter a valid WhatsApp number, e.g. 712 345 678' if supplied
            else 'Enter your WhatsApp number'
        )

    dial = (dial_code_for(country) or dial_code_for(DEFAULT_COUNTRY)).lstrip('+')

    if digits.startswith('+'):
        candidate = digits
    else:
        national = digits.lstrip('0')
        if not national:
            raise InvalidPhone('Enter a valid WhatsApp number')
        # Already carries its country code (a user who typed 254712345678).
        candidate = f'+{national}' if national.startswith(dial) else f'+{dial}{national}'

    if not _E164_RE.match(candidate):
        raise InvalidPhone('Enter a valid WhatsApp number, e.g. 712 345 678')
    return candidate


def mask_phone(e164):
    """``+254114080686`` -> ``+254 ***** 0686``, for logs and error copy.

    The signup UI echoes the full number back to the person who just typed it —
    that is fine. This is for everywhere else.
    """
    value = str(e164 or '')
    if len(value) < 6:
        return value
    return f'{value[:4]} ***** {value[-4:]}'
