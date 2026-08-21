"""Credit router downtime back to the subscribers who lost service.

Called by whatever notices a router's state change. :func:`open_outage` on the
way down, :func:`close_outage` on the way back up; the credit runs once, on
recovery, and ``DeviceOutage.compensated_at`` records that it did so a flapping
router cannot pay the same downtime twice.

Who was affected is answered by RADIUS accounting rather than a guess: a
subscriber counts if they had a session on that NAS overlapping the outage.
Crediting every subscriber of the ISP would be simpler and wrong — a customer
on a different router lost nothing, and handing them free time is a real cost.

Short blips are ignored (``ISP.outage_min_minutes``). A thirty-second
reconnect is not worth a credit, and crediting it would bury the outages that
actually matter under noise.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta

from extensions import db
from models import Customer, DeviceOutage, ISP, RadAcct

logger = logging.getLogger(__name__)


def open_outage(device, when=None):
    """Record that a device stopped responding. Idempotent while still down."""
    if device is None:
        return None
    existing = (DeviceOutage.query
                .filter_by(device_id=device.id, ended_at=None)
                .order_by(DeviceOutage.started_at.desc()).first())
    if existing is not None:
        return existing

    outage = DeviceOutage(
        isp_id=device.isp_id, device_id=device.id, started_at=when or datetime.utcnow())
    db.session.add(outage)
    db.session.commit()
    logger.info('Outage opened for device=%s', device.id)
    return outage


def affected_customers(device, started_at, ended_at):
    """Subscribers with a RADIUS session on this NAS during the outage.

    Overlap, not containment: someone whose session began before the router
    died and was still open when it did is exactly who lost service.
    """
    ip = (device.device_ip or '').strip()
    if not ip:
        return []

    sessions = (RadAcct.query
                .filter(RadAcct.nasipaddress == ip)
                .filter(RadAcct.acctstarttime.isnot(None))
                .filter(RadAcct.acctstarttime <= ended_at)
                .filter(db.or_(RadAcct.acctstoptime.is_(None),
                               RadAcct.acctstoptime >= started_at))
                .all())
    logins = {(s.username or '').strip().lower() for s in sessions if s.username}
    if not logins:
        return []

    # radius_login is the operator-facing login; email is the legacy fallback.
    customers = (Customer.query
                 .filter(Customer.isp_id == device.isp_id)
                 .filter(db.or_(
                     db.func.lower(Customer.radius_login).in_(logins),
                     db.func.lower(Customer.email).in_(logins),
                 ))
                 .all())
    return customers


def close_outage(device, when=None, compensate=None):
    """Close the open outage and, if enabled, credit the downtime.

    Returns ``(outage, credited_customers, minutes)``.
    """
    if device is None:
        return None, 0, 0
    ended_at = when or datetime.utcnow()
    outage = (DeviceOutage.query
              .filter_by(device_id=device.id, ended_at=None)
              .order_by(DeviceOutage.started_at.desc()).first())
    if outage is None:
        return None, 0, 0

    outage.ended_at = ended_at
    minutes = outage.duration_minutes()

    isp = ISP.query.get(device.isp_id)
    enabled = compensate if compensate is not None else bool(
        isp and isp.outage_compensation_enabled)
    threshold = int((isp.outage_min_minutes if isp else None) or 15)

    if not enabled or minutes < threshold or outage.compensated_at is not None:
        db.session.commit()
        return outage, 0, minutes

    credited = 0
    for customer in affected_customers(device, outage.started_at, ended_at):
        if not customer.subscription_end:
            # Nothing to extend — a prepaid account with no expiry gains
            # nothing from being pushed forward.
            continue
        customer.subscription_end = customer.subscription_end + timedelta(minutes=minutes)
        credited += 1

    outage.compensated_at = datetime.utcnow()
    outage.compensated_customers = credited
    outage.compensated_minutes = minutes
    db.session.commit()
    logger.info('Outage closed for device=%s: %s min credited to %s subscribers',
                device.id, minutes, credited)
    return outage, credited, minutes


def recent(isp_id, limit=20):
    return (DeviceOutage.query
            .filter_by(isp_id=isp_id)
            .order_by(DeviceOutage.started_at.desc())
            .limit(limit).all())


def serialize(outage):
    return {
        'id': outage.id,
        'device_id': outage.device_id,
        'device_name': getattr(outage.device, 'device_name', None),
        'started_at': outage.started_at.isoformat() if outage.started_at else None,
        'ended_at': outage.ended_at.isoformat() if outage.ended_at else None,
        'minutes': outage.duration_minutes(),
        'open': outage.is_open,
        'compensated_at': outage.compensated_at.isoformat() if outage.compensated_at else None,
        'compensated_customers': outage.compensated_customers or 0,
        'compensated_minutes': outage.compensated_minutes or 0,
    }
