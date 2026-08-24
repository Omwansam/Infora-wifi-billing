"""Poll every router on a timer so trend and downtime data actually exist.

Two things on the device detail page — the resource trend and the downtime log
— are only as good as how often something looks at the router. Before this,
nothing did: a device was synced when an operator pressed Sync or opened a
page, so the trend had holes the shape of the working day and an outage that
started and ended overnight was never recorded at all.

Running this in-process rather than as a cron entry is deliberate: the image
ships no crontab, and the prod entrypoint execs gunicorn directly. That means
four worker processes would each start a loop, so a tick is guarded by a
non-blocking flock — whoever wins polls, the rest skip. The lock is taken per
tick rather than held for the process lifetime, so a worker dying mid-poll
hands the job to the next one on its next tick instead of stopping polling
until a redeploy.
"""
from __future__ import annotations

import fcntl
import logging
import os
import threading
import time
from datetime import datetime, timedelta

from extensions import db
from models import DeviceStatus, MikrotikDevice

logger = logging.getLogger(__name__)

_LOCK_PATH = '/tmp/infora-device-poller.lock'


class _TickLock:
    """Non-blocking flock so exactly one gunicorn worker runs a given tick."""

    def __init__(self, path=_LOCK_PATH):
        self.path = path
        self.fd = None

    def __enter__(self):
        try:
            self.fd = os.open(self.path, os.O_CREAT | os.O_RDWR, 0o644)
            fcntl.flock(self.fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            return True
        except OSError:
            if self.fd is not None:
                os.close(self.fd)
                self.fd = None
            return False

    def __exit__(self, *exc):
        if self.fd is not None:
            try:
                fcntl.flock(self.fd, fcntl.LOCK_UN)
            finally:
                os.close(self.fd)
                self.fd = None
        return False


def due_devices(interval_seconds, now=None):
    """Active devices that have not been synced within the interval.

    Skipping the freshly-synced ones is what keeps the poller cheap and stops
    it fighting an operator who is already on the device page pressing Sync.
    """
    now = now or datetime.utcnow()
    cutoff = now - timedelta(seconds=max(30, int(interval_seconds * 0.75)))
    return (MikrotikDevice.query
            .filter(MikrotikDevice.is_active.is_(True))
            .filter(db.or_(MikrotikDevice.last_synced.is_(None),
                           MikrotikDevice.last_synced < cutoff))
            .order_by(MikrotikDevice.last_synced.asc().nullsfirst())
            .all())


def poll_once(interval_seconds=300, limit=None):
    """Sync every due device once. Returns a small summary for the CLI/logs.

    Failures are per-device: one unreachable router must not stop the rest of
    the fleet being polled, and an unreachable router is itself the signal the
    downtime log exists to record.
    """
    from services.device_config_ops import DeviceBusy
    from services.mikrotik_sync import mark_unreachable, sync_device_stats

    summary = {'polled': 0, 'online': 0, 'offline': 0, 'busy': 0, 'errors': 0}
    devices = due_devices(interval_seconds)
    if limit:
        devices = devices[:limit]

    for device in devices:
        summary['polled'] += 1
        try:
            # lock_wait=2: a poll is routine work and must yield to anything an
            # operator started, rather than queueing behind it for 20 seconds.
            sync_device_stats(device, lock_wait=2)
            summary['online'] += 1
        except DeviceBusy:
            # Something else holds the router — which proves it is reachable, so
            # this is emphatically not evidence of an outage.
            db.session.rollback()
            summary['busy'] += 1
        except Exception as exc:  # noqa: BLE001
            db.session.rollback()
            fresh = MikrotikDevice.query.get(device.id)
            if fresh is None:
                summary['errors'] += 1
                continue
            try:
                # Hysteresis lives here, and this is the call that opens a
                # DeviceOutage row when a router is genuinely gone.
                status = mark_unreachable(fresh, already_probed=True)
                if status == DeviceStatus.OFFLINE:
                    summary['offline'] += 1
                else:
                    summary['online'] += 1
            except Exception:  # noqa: BLE001
                db.session.rollback()
                summary['errors'] += 1
                logger.warning('Poll failed for device %s: %s', device.id, exc)

    return summary


def start_poller(app):
    """Start the background poll loop when DEVICE_POLL_INTERVAL is set."""
    interval = int(app.config.get('DEVICE_POLL_INTERVAL', 0) or 0)
    if interval <= 0:
        return None

    def _loop():
        # Stagger the first tick. Four workers booting together would otherwise
        # all reach the lock in the same millisecond, and the losers would spin
        # through a whole interval before trying again.
        time.sleep(min(30, interval) * (0.5 + os.getpid() % 10 / 10.0))
        while True:
            try:
                with _TickLock() as won:
                    if won:
                        with app.app_context():
                            summary = poll_once(interval_seconds=interval)
                            if summary['polled']:
                                app.logger.info('Device poll: %s', summary)
            except Exception as exc:  # noqa: BLE001 — the loop must not die
                try:
                    app.logger.warning('Device poll tick failed: %s', exc)
                except Exception:  # noqa: BLE001
                    pass
            time.sleep(interval)

    thread = threading.Thread(target=_loop, daemon=True, name='device-poller')
    thread.start()
    app.logger.info('Device poller started (every %ss)', interval)
    return thread
