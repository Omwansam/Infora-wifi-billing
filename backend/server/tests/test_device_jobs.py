"""Background router jobs — the reaper, and what counts as a finished job.

Configuring dual-WAN outlives an HTTP request, so it runs on a thread and reports
through a database row. Two things about that row decide whether the console
recovers from a bad push or wedges:

  * A job whose worker died must eventually stop counting as running. Nothing
    else clears it, and `running_job_for` refuses to start a second push while
    one is live -- so a row left running by a redeploy would block that router
    permanently.
  * A push that ran every command but failed verification is a *finished* job
    carrying a negative result, not a crashed one. Marking it failed would hide
    the log the operator needs.

Reaper and serialisation logic only -- the thread and the database are stubbed.

Run: backend/.venv/bin/python -m pytest backend/server/tests -q
"""
import json
import os
import sys
from datetime import datetime, timedelta

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services import device_jobs  # noqa: E402


class FakeJob:
    def __init__(self, status='running', age_minutes=0):
        self.id = 1
        self.device_id = 6
        self.kind = 'load_balancing'
        self.status = status
        self.error = None
        self.result = None
        self.created_at = datetime.utcnow() - timedelta(minutes=age_minutes)
        self.finished_at = None


class FakeQuery:
    def __init__(self, job):
        self._job = job

    def filter_by(self, **kwargs):
        return self

    def order_by(self, *args):
        return self

    def first(self):
        return self._job


@pytest.fixture
def committed(monkeypatch):
    """Records commits so the reaper's write is observable."""
    calls = []
    monkeypatch.setattr(device_jobs.db, 'session',
                        type('S', (), {'commit': staticmethod(lambda: calls.append('commit')),
                                       'rollback': staticmethod(lambda: None),
                                       'add': staticmethod(lambda o: None)})())
    return calls


def _patch_query(monkeypatch, job):
    # The whole model is swapped rather than its `query` attribute: assigning to
    # `query` on a Flask-SQLAlchemy model goes through its descriptor and needs
    # an app context these tests deliberately do without.
    # `created_at` is used as a column expression (`.desc()`) in the order_by, so
    # the stub needs one even though FakeQuery ignores the ordering.
    class Column:
        def desc(self):
            return self

    stub = type('DeviceJob', (), {'query': FakeQuery(job), 'created_at': Column()})
    monkeypatch.setattr(device_jobs, 'DeviceJob', stub)


def test_no_job_means_the_device_is_free(monkeypatch, committed):
    _patch_query(monkeypatch, None)

    assert device_jobs.running_job_for(6, 'load_balancing') is None


def test_a_fresh_running_job_blocks_a_second_push(monkeypatch, committed):
    """Two concurrent pushes to one router is how a half-applied config happens."""
    job = FakeJob(age_minutes=1)
    _patch_query(monkeypatch, job)

    assert device_jobs.running_job_for(6, 'load_balancing') is job
    assert job.status == 'running'
    assert committed == []


def test_a_job_whose_worker_died_is_reaped(monkeypatch, committed):
    """Otherwise a redeploy mid-push blocks that router forever."""
    job = FakeJob(age_minutes=30)
    _patch_query(monkeypatch, job)

    assert device_jobs.running_job_for(6, 'load_balancing') is None
    assert job.status == 'failed'
    assert job.finished_at is not None
    assert 'partly configured' in job.error
    assert committed == ['commit']


def test_the_reaper_boundary_is_the_stale_window(monkeypatch, committed):
    """Just inside the window still counts as live; just outside does not."""
    fresh = FakeJob(age_minutes=(device_jobs.STALE_AFTER.total_seconds() / 60) - 1)
    _patch_query(monkeypatch, fresh)
    assert device_jobs.running_job_for(6, 'load_balancing') is fresh

    stale = FakeJob(age_minutes=(device_jobs.STALE_AFTER.total_seconds() / 60) + 1)
    _patch_query(monkeypatch, stale)
    assert device_jobs.running_job_for(6, 'load_balancing') is None


def test_a_job_with_no_timestamp_is_not_reaped(monkeypatch, committed):
    """A missing created_at must not read as infinitely old and kill a live push."""
    job = FakeJob()
    job.created_at = None
    _patch_query(monkeypatch, job)

    assert device_jobs.running_job_for(6, 'load_balancing') is job


# --- What the console reads ------------------------------------------------

def test_a_failed_verification_serialises_as_a_finished_job():
    """`ok: false` is the operation's verdict; the job itself completed."""
    from models import DeviceJob

    job = DeviceJob(device_id=6, kind='load_balancing', status='done')
    job.result = json.dumps({'ok': False, 'applied': True, 'error': 'route not active'})
    out = job.to_dict()

    assert out['status'] == 'done'
    assert out['result']['ok'] is False
    assert out['result']['error'] == 'route not active'


def test_unparseable_result_does_not_break_the_poll():
    """The column is text; a truncated write must not 500 the polling endpoint."""
    from models import DeviceJob

    job = DeviceJob(device_id=6, kind='load_balancing', status='done')
    job.result = '{"ok": true, trunc'

    assert job.to_dict()['result'] == {}
