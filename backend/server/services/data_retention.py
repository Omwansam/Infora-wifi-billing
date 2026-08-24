"""Purge old hotspot customers and transactions per ISP data-retention policy."""
from datetime import datetime, timedelta

from extensions import db
from models import Customer, ISP, Invoice, Payment, CustomerStatus
from services.radius_provisioning import deprovision_customer_radius, radius_username


def purge_expired_data(dry_run=False):
    """Delete expired hotspot users and old paid records past each ISP's retention window."""
    isps = ISP.query.filter(ISP.data_retention_days.isnot(None)).all()
    summary = {'customers': 0, 'invoices': 0, 'payments': 0, 'cpe_sessions': 0,
               'device_samples': 0}
    now = datetime.utcnow()

    # Router trend samples: one device at a 5-minute poll writes ~8.6k rows a
    # month, so like CWMP sessions these are capped globally by volume rather
    # than per-ISP by policy.
    from services.device_resource_history import purge_old_samples
    summary['device_samples'] = purge_old_samples(now=now, dry_run=dry_run)

    # CWMP session rows are high churn — every managed CPE opens one per
    # periodic inform interval (5 min by default), so a 1000-device fleet writes
    # ~288k rows a day. They exist for troubleshooting a recent problem, not as
    # history. Retention is global rather than per-ISP because the volume, not
    # the tenant, is what makes them expensive.
    summary['cpe_sessions'] = _purge_cpe_sessions(now, dry_run)

    for isp in isps:
        days = max(7, int(isp.data_retention_days))
        cutoff = now - timedelta(days=days)

        expired_customers = Customer.query.filter(
            Customer.isp_id == isp.id,
            Customer.connection_type == 'hotspot',
            Customer.subscription_end.isnot(None),
            Customer.subscription_end < cutoff,
        ).all()

        for customer in expired_customers:
            if not dry_run:
                deprovision_customer_radius(customer, isp)
                Payment.query.filter_by(customer_id=customer.id).delete(synchronize_session=False)
                Invoice.query.filter_by(customer_id=customer.id).delete(synchronize_session=False)
                db.session.delete(customer)
            summary['customers'] += 1

        old_payments = Payment.query.join(Customer).filter(
            Customer.isp_id == isp.id,
            Payment.payment_date.isnot(None),
            Payment.payment_date < cutoff,
        ).all()
        for p in old_payments:
            if not dry_run:
                db.session.delete(p)
            summary['payments'] += 1

    if not dry_run and any(summary.values()):
        db.session.commit()
    return summary


def _purge_cpe_sessions(now, dry_run):
    """Drop CWMP session rows past the retention window."""
    from flask import current_app
    from models import CpeSession

    days = int(current_app.config.get('TR069_SESSION_RETENTION_DAYS', 7) or 7)
    cutoff = now - timedelta(days=max(1, days))
    query = CpeSession.query.filter(CpeSession.started_at < cutoff)
    if dry_run:
        return query.count()
    return query.delete(synchronize_session=False)
