"""Subscriber segments — the filters behind the list page's worklist chips.

These pin the two ways a segment filter goes wrong quietly, both of which return
a plausible-looking page rather than an error:

  * an empty match set inverted into "everyone", or
  * a non-empty one inverted into "nobody".

`dark` and `unstable` are the pair at risk, because both build a Python set from
radacct first and then filter customers against it. `dark` must match everyone
when nobody has connected; `unstable` must match nobody when nothing is flapping.
Getting either backwards produces a full list or an empty one, and both look like
a working feature until someone counts.

Query construction only — the filters are asserted through a stub, so no
database.

Run: backend/.venv/bin/python -m pytest backend/server/tests -q
"""
import os
import sys
from datetime import datetime, timedelta

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services import subscriber_segments as segments  # noqa: E402


class StubQuery:
    """Records what `filter` was asked for without touching a database."""

    def __init__(self):
        self.calls = []

    def filter(self, *criteria):
        self.calls.append(criteria)
        return self

    def count(self):
        return 0


def test_every_catalogue_entry_is_renderable():
    """The UI builds a chip per row, so each needs the fields it reads."""
    for entry in segments.catalogue():
        assert entry['key'] and entry['label'] and entry['description']
        assert entry['tone'] in {'warning', 'critical', 'info', 'neutral', 'good'}


def test_catalogue_is_a_copy_not_the_module_state():
    """A caller mutating the response must not edit the catalogue for everyone."""
    first = segments.catalogue()
    first[0]['label'] = 'mutated'

    assert segments.catalogue()[0]['label'] != 'mutated'


@pytest.mark.parametrize('key', [None, '', 'all', 'not-a-real-segment'])
def test_unknown_segments_pass_the_query_through(key):
    """A stale bookmark should show the full list, not an error page."""
    query = StubQuery()

    assert segments.apply_segment(query, key) is query
    assert query.calls == []


# `never_paid` is absent on purpose: it builds a real subquery against Payment and
# so needs an app context, which these deliberately do without. It is covered by
# the live check against production data instead.
@pytest.mark.parametrize('key', ['expiring', 'expired', 'throttled'])
def test_known_segments_narrow_the_query(key):
    query = StubQuery()

    segments.apply_segment(query, key)

    assert query.calls, f'{key} applied no filter'


def test_dark_matches_everyone_when_nobody_has_connected(monkeypatch):
    """Nobody seen in 48h means every active subscriber is dark."""
    monkeypatch.setattr(segments, '_logins_with_recent_session', lambda since: set())
    query = StubQuery()

    segments.apply_segment(query, 'dark')

    # Status filter plus a pass-through, never an inverted empty set.
    assert query.calls and True in query.calls[0]


def test_dark_excludes_logins_seen_recently(monkeypatch):
    monkeypatch.setattr(segments, '_logins_with_recent_session', lambda since: {'ann'})
    query = StubQuery()

    segments.apply_segment(query, 'dark')

    assert query.calls and True not in query.calls[0]


def test_unstable_matches_nobody_when_nothing_is_flapping(monkeypatch):
    """The inverse trap: no flapping lines must not select the whole fleet."""
    monkeypatch.setattr(segments, '_logins_flapping', lambda since, threshold=5: set())
    query = StubQuery()

    segments.apply_segment(query, 'unstable')

    assert len(query.calls) == 1  # a false() filter, not a pass-through


def test_unstable_selects_only_the_flapping_logins(monkeypatch):
    monkeypatch.setattr(segments, '_logins_flapping', lambda since, threshold=5: {'david'})
    query = StubQuery()

    segments.apply_segment(query, 'unstable')

    assert len(query.calls) == 1


def test_session_windows_do_not_borrow_the_expiry_clock(monkeypatch):
    """radacct runs on local time, subscription_end on UTC. Mixing them shifts
    every session window by the tenant's offset without any visible error."""
    seen = {}
    monkeypatch.setattr(segments, '_logins_with_recent_session',
                        lambda since: seen.setdefault('since', since) and set())
    monkeypatch.setattr(segments, '_session_now', lambda: datetime(2026, 1, 1, 12, 0))

    segments.apply_segment(StubQuery(), 'dark', now=datetime(2020, 6, 6, 6, 0))

    # The window came off _session_now, not off the UTC `now` that was passed in.
    assert seen['since'] == datetime(2026, 1, 1, 12, 0) - timedelta(hours=48)


def test_counts_survive_one_broken_segment(monkeypatch):
    """A segment that raises must not blank the whole chip row."""
    def explode(query, key, now=None):
        if key == 'expired':
            raise RuntimeError('boom')
        return StubQuery()

    monkeypatch.setattr(segments, 'apply_segment', explode)

    result = segments.counts(StubQuery())

    assert result['expired'] is None
    assert result['expiring'] == 0
