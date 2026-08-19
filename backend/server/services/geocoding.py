"""Turn free-text addresses into coordinates, via OSM Nominatim.

Used to bulk-place subscribers who predate the fiber map. Two honest caveats
baked into how this is used:

1. **Nominatim's usage policy is one request per second, with a real
   User-Agent.** We serialise and identify ourselves. Exceeding it gets the
   deployment's IP blocked, which breaks the feature for everyone on the box.
2. **Kenyan informal addresses geocode badly.** "Behind Total, Ruiru" resolves
   to a town centroid at best. Every result is stamped `geo_source='geocode'`
   so a rough pin is never mistaken for a surveyed position, and the map shows
   them differently.
"""
import time

import requests
from flask import current_app

NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
# Nominatim requires a contactable identifier; a generic agent gets blocked.
USER_AGENT = 'LumenBilling/1.0 (fiber plant mapping)'
MIN_INTERVAL_SECONDS = 1.1
# Bias results to the operator's country so "Ruiru" is not Ruiru, Somewhere Else.
DEFAULT_COUNTRY = 'ke'

_last_call = [0.0]


class GeocodeError(Exception):
    pass


def _throttle():
    elapsed = time.time() - _last_call[0]
    if elapsed < MIN_INTERVAL_SECONDS:
        time.sleep(MIN_INTERVAL_SECONDS - elapsed)
    _last_call[0] = time.time()


def geocode(address, country=None, timeout=12):
    """-> (lat, lng, display_name) or None. Never raises for a bad address."""
    query = (address or '').strip()
    if not query:
        return None

    _throttle()
    params = {
        'q': query,
        'format': 'json',
        'limit': 1,
        'countrycodes': (country or current_app.config.get('GEOCODE_COUNTRY')
                         or DEFAULT_COUNTRY),
    }
    try:
        response = requests.get(
            NOMINATIM_URL, params=params,
            headers={'User-Agent': USER_AGENT, 'Accept-Language': 'en'},
            timeout=timeout,
        )
        response.raise_for_status()
        results = response.json()
    except requests.RequestException as exc:
        raise GeocodeError(f'Geocoder unreachable: {exc}') from exc
    except ValueError as exc:
        raise GeocodeError(f'Geocoder returned junk: {exc}') from exc

    if not results:
        return None
    top = results[0]
    try:
        return float(top['lat']), float(top['lon']), top.get('display_name', '')
    except (KeyError, TypeError, ValueError):
        return None


def geocode_customers(customers, limit=50, country=None):
    """Place a batch of subscribers from their address text.

    Capped per call because at one request per second a large fleet would hold
    a worker for minutes. The caller pages through.
    """
    from datetime import datetime

    from extensions import db

    placed, skipped, failed = 0, 0, []
    for customer in customers[:limit]:
        if customer.latitude is not None and customer.longitude is not None:
            skipped += 1
            continue
        if not (customer.address or '').strip():
            skipped += 1
            continue
        try:
            hit = geocode(customer.address, country=country)
        except GeocodeError as exc:
            # Stop the batch rather than hammer a geocoder that is down.
            failed.append({'customer_id': customer.id, 'error': str(exc)})
            break
        if not hit:
            failed.append({'customer_id': customer.id, 'error': 'No match'})
            continue
        customer.latitude, customer.longitude, _ = hit
        customer.geo_source = 'geocode'
        customer.geo_updated_at = datetime.utcnow()
        placed += 1

    if placed:
        db.session.commit()
    return {'placed': placed, 'skipped': skipped, 'failed': failed}
