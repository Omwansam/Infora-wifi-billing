"""Resource trend for a router: write one sample per poll, read back a window.

The device row carries only the newest reading, which cannot answer "was it
like this an hour ago". These samples are what turn the detail page's Resource
History tab into something an operator can act on — a router that pins its CPU
every evening is invisible in a snapshot and obvious in a series.

Writes are throttled (``DEVICE_SAMPLE_MIN_INTERVAL``) because a sample is
recorded on *every* successful stat sync, and several operators sitting on the
device page would otherwise write a row per refresh. Reads downsample into
fixed buckets so a 7-day window costs the browser the same as a 1-hour one.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta

from flask import current_app

from extensions import db
from models import DeviceResourceSample

logger = logging.getLogger(__name__)

# Fallbacks for when there is no app context (unit tests).
_DEFAULT_MIN_INTERVAL_SECONDS = 60
_DEFAULT_RETENTION_DAYS = 30

# Window presets the UI offers, and the bucket each one downsamples into.
# The bucket is chosen so every window lands at 48-96 points: dense enough to
# show a spike, sparse enough to stay legible and cheap to draw.
WINDOWS = {
    '1h': {'hours': 1, 'bucket_minutes': 1, 'label': 'Last hour'},
    '6h': {'hours': 6, 'bucket_minutes': 5, 'label': 'Last 6 hours'},
    '24h': {'hours': 24, 'bucket_minutes': 20, 'label': 'Last 24 hours'},
    '7d': {'hours': 24 * 7, 'bucket_minutes': 120, 'label': 'Last 7 days'},
}
DEFAULT_WINDOW = '6h'


def _config_int(key, fallback):
    try:
        return int(current_app.config.get(key, fallback) or fallback)
    except Exception:  # noqa: BLE001 — no app context
        return fallback


def _min_interval_seconds():
    return _config_int('DEVICE_SAMPLE_MIN_INTERVAL', _DEFAULT_MIN_INTERVAL_SECONDS)


def record_sample(device, when=None, force=False):
    """Persist the device's current vitals as a point in its history.

    Returns the row, or ``None`` when the throttle skipped it. Best-effort by
    design: history is a nicety and must never be the reason a sync fails, so
    every error is swallowed after a rollback.
    """
    if device is None or device.id is None:
        return None

    now = when or datetime.utcnow()

    # Nothing worth plotting. A router that answered but reported no vitals
    # would otherwise draw a run of zeros that reads as "CPU crashed to 0".
    if device.cpu_load is None and device.mem_total is None and device.client_count is None:
        return None

    try:
        if not force:
            cutoff = now - timedelta(seconds=_min_interval_seconds())
            recent = (DeviceResourceSample.query
                      .filter(DeviceResourceSample.device_id == device.id)
                      .filter(DeviceResourceSample.sampled_at >= cutoff)
                      .first())
            if recent is not None:
                return None

        sample = DeviceResourceSample(
            isp_id=device.isp_id,
            device_id=device.id,
            sampled_at=now,
            cpu_load=device.cpu_load,
            mem_total=device.mem_total,
            mem_free=device.mem_free,
            hdd_total=device.hdd_total,
            hdd_free=device.hdd_free,
            client_count=device.client_count,
            bandwidth_kbps=device.bandwidth_usage,
            uptime=device.uptime,
        )
        db.session.add(sample)
        db.session.commit()
        return sample
    except Exception as exc:  # noqa: BLE001
        db.session.rollback()
        logger.warning('Resource sample failed for device %s: %s', device.id, exc)
        return None


def _bucket_start(moment, bucket_minutes):
    """Floor a timestamp onto the bucket grid, so buckets line up across reads."""
    minutes = moment.hour * 60 + moment.minute
    floored = (minutes // bucket_minutes) * bucket_minutes
    return moment.replace(
        hour=floored // 60, minute=floored % 60, second=0, microsecond=0)


def _average(values):
    values = [v for v in values if v is not None]
    if not values:
        return None
    return round(sum(values) / len(values), 1)


def history(device, window=DEFAULT_WINDOW, now=None):
    """Downsampled series for one device, plus the summary the header shows.

    Every bucket in the window is emitted, with null readings where nothing was
    recorded. A stretch where the router was unreachable is a real hole, and
    the nulls are what make the chart draw it as one instead of joining a
    confident straight line across a period nobody measured.
    """
    spec = WINDOWS.get(window) or WINDOWS[DEFAULT_WINDOW]
    now = now or datetime.utcnow()
    since = now - timedelta(hours=spec['hours'])

    rows = (DeviceResourceSample.query
            .filter(DeviceResourceSample.device_id == device.id)
            .filter(DeviceResourceSample.sampled_at >= since)
            .order_by(DeviceResourceSample.sampled_at.asc())
            .all())

    buckets = {}
    for row in rows:
        key = _bucket_start(row.sampled_at, spec['bucket_minutes'])
        buckets.setdefault(key, []).append(row)

    # Emit *every* bucket in the window, not just the ones with readings. An
    # absent bucket and a bucket of nulls look the same in a table and utterly
    # different in a chart: with only the present points, a plot joins straight
    # across a two-hour outage and claims the router was fine throughout. The
    # explicit nulls are what let the line break where the data actually stops.
    step = timedelta(minutes=spec['bucket_minutes'])
    points = []
    cursor = _bucket_start(since, spec['bucket_minutes'])
    end = _bucket_start(now, spec['bucket_minutes'])
    while cursor <= end:
        group = buckets.get(cursor) or []
        points.append({
            't': cursor.isoformat() + 'Z',
            'cpu': _average([r.cpu_load for r in group]),
            'memory': _average([r.memory_percent for r in group]),
            'disk': _average([r.disk_percent for r in group]),
            'clients': _average([r.client_count for r in group]),
            'bandwidth_kbps': _average([r.bandwidth_kbps for r in group]),
            'samples': len(group),
        })
        cursor += step

    return {
        'window': window if window in WINDOWS else DEFAULT_WINDOW,
        'label': spec['label'],
        'bucket_minutes': spec['bucket_minutes'],
        'since': since.isoformat() + 'Z',
        'until': now.isoformat() + 'Z',
        'points': points,
        'sample_count': len(rows),
        'summary': _summary(rows),
        'windows': [
            {'key': k, 'label': v['label']} for k, v in WINDOWS.items()
        ],
    }


def _summary(rows):
    """Current / average / peak for the window, from the raw rows not the buckets.

    Peak has to come from raw samples — averaging into buckets first would hide
    the very spike the operator opened this tab to find.
    """
    if not rows:
        return {
            'cpu': None, 'memory': None, 'disk': None,
            'clients': None, 'bandwidth_kbps': None,
        }

    latest = rows[-1]

    def stat(getter):
        values = [v for v in (getter(r) for r in rows) if v is not None]
        if not values:
            return None
        return {
            'current': round(getter(latest), 1) if getter(latest) is not None else None,
            'avg': round(sum(values) / len(values), 1),
            'peak': round(max(values), 1),
        }

    return {
        'cpu': stat(lambda r: r.cpu_load),
        'memory': stat(lambda r: r.memory_percent),
        'disk': stat(lambda r: r.disk_percent),
        'clients': stat(lambda r: r.client_count),
        'bandwidth_kbps': stat(lambda r: r.bandwidth_kbps),
        'first_sample': rows[0].sampled_at.isoformat() + 'Z',
        'last_sample': latest.sampled_at.isoformat() + 'Z',
    }


def purge_old_samples(now=None, dry_run=False):
    """Drop samples past the retention window. Called by the retention purge."""
    days = max(1, _config_int('DEVICE_SAMPLE_RETENTION_DAYS', _DEFAULT_RETENTION_DAYS))
    cutoff = (now or datetime.utcnow()) - timedelta(days=days)
    query = DeviceResourceSample.query.filter(DeviceResourceSample.sampled_at < cutoff)
    if dry_run:
        return query.count()
    return query.delete(synchronize_session=False)
