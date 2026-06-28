"""Purge old hotspot customers and transactions per ISP data-retention policy."""
from datetime import datetime, timedelta

from extensions import db
from models import Customer, ISP, Invoice, Payment, CustomerStatus
from services.radius_provisioning import deprovision_customer_radius, radius_username


def purge_expired_data(dry_run=False):
    """Delete expired hotspot users and old paid records past each ISP's retention window."""
    isps = ISP.query.filter(ISP.data_retention_days.isnot(None)).all()
    summary = {'customers': 0, 'invoices': 0, 'payments': 0}
    now = datetime.utcnow()

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
