"""Run long router operations outside the HTTP request that asked for them.

Configuring dual-WAN opens three SSH sessions over the management tunnel and
reads sixteen `print` commands from a router where a single call measures in tens
of seconds. It routinely passes Cloudflare's ~100s origin ceiling, which answers
the browser with a 524 -- and `config/deployment/fibi-proxy/20-infora-billing-https.conf`
already says what to do about that: "anything genuinely slower than 100s has to
become an async job, not a longer timeout."

The 524 was only half of it. Cloudflare giving up does not stop the work:
gunicorn runs the worker on to its own 300s timeout, still holding the per-device
SSH lock, so the operator's retry died with "device busy" and the console
appeared broken twice for one slow push.

Mirrors `router_scan.start_device_scan`: persist a row, hand back its id, do the
work on a thread inside an app context, and make sure a failure lands on the row
rather than vanishing into a dead thread.
"""
import json
import threading
from datetime import datetime, timedelta

from extensions import db
from models import DeviceJob

# A job older than this that is still marked running has lost its thread -- a
# worker restart, an OOM kill, a redeploy mid-push. Nothing would ever clear it,
# and `running_job_for` would then block the device forever.
STALE_AFTER = timedelta(minutes=10)


def running_job_for(device_id, kind):
    """The live job for this device, or None. Reaps rows whose thread is gone."""
    job = (
        DeviceJob.query
        .filter_by(device_id=device_id, kind=kind, status='running')
        .order_by(DeviceJob.created_at.desc())
        .first()
    )
    if not job:
        return None
    if job.created_at and datetime.utcnow() - job.created_at > STALE_AFTER:
        job.status = 'failed'
        job.error = (
            'The worker running this job stopped before it finished. The router '
            'may be partly configured — check the load-balancing status before '
            'retrying.'
        )
        job.finished_at = datetime.utcnow()
        db.session.commit()
        return None
    return job


def start_job(app, device, kind, payload, user_id, work):
    """Persist a job, run `work(device)` on a thread, return the row immediately.

    ``work`` is called with a freshly-loaded device inside the thread's app
    context and must return a JSON-serialisable dict. Raising is fine: the
    exception is recorded on the row, which is the whole point of having one.
    """
    job = DeviceJob(
        device_id=device.id,
        isp_id=device.isp_id,
        kind=kind,
        status='running',
        request_payload=json.dumps(payload or {})[:20000],
        created_by=user_id,
    )
    db.session.add(job)
    db.session.commit()
    job_id, device_id = job.id, device.id

    def _run():
        with app.app_context():
            from models import MikrotikDevice
            record = DeviceJob.query.get(job_id)
            target = MikrotikDevice.query.get(device_id)
            if not record:
                return
            if not target:
                record.status = 'failed'
                record.error = 'Device no longer exists.'
                record.finished_at = datetime.utcnow()
                db.session.commit()
                return
            try:
                result = work(target)
                record = DeviceJob.query.get(job_id)
                record.result = json.dumps(result or {})[:200000]
                # `ok` is the operation's own verdict — a push that ran every
                # command but failed verification is a finished job with a
                # negative result, not a crashed one.
                record.status = 'done'
                record.finished_at = datetime.utcnow()
                db.session.commit()
            except Exception as exc:  # noqa: BLE001 — must surface on the row
                db.session.rollback()
                record = DeviceJob.query.get(job_id)
                if record:
                    record.status = 'failed'
                    record.error = str(exc)[:2000]
                    record.finished_at = datetime.utcnow()
                    db.session.commit()

    threading.Thread(target=_run, daemon=True, name=f'devicejob-{job_id}').start()
    return job
