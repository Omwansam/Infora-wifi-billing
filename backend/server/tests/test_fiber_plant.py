"""Tests for the fiber plant maths.

Two things here are worth guarding. The **loss budget** is what separates "this
subscriber is far out on a big split, so a low reading is expected" from "this
one should be fine and is not" — get it wrong and every ONT looks either healthy
or broken. **Fault localisation** is what turns five slow-internet calls into
one van trip to a splice point; a bad threshold either cries wolf or stays quiet
while a branch is down.

No database — every function takes the objects it works on.

Run: backend/.venv/bin/python -m pytest backend/server/tests -q
"""
import os
import sys
from types import SimpleNamespace

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services import fiber_geo as geo  # noqa: E402


def node(id_, kind='odb', parent=None, **kw):
    return SimpleNamespace(
        id=id_, kind=kind, parent_id=parent, name=kw.get('name', f'{kind}-{id_}'),
        latitude=kw.get('lat'), longitude=kw.get('lng'),
        split_ratio=kw.get('split_ratio'), splitter_loss_db=kw.get('loss'),
        port_count=kw.get('ports'), status=kw.get('status', 'active'),
    )


def cable(from_id, to_id, length_m=0.0, slack_m=0.0):
    return SimpleNamespace(from_node_id=from_id, to_node_id=to_id,
                           length_m=length_m, slack_m=slack_m)


def ont(id_, node_id, rx):
    return SimpleNamespace(id=id_, fiber_node_id=node_id, rx_power_dbm=rx)


# --- geometry ---------------------------------------------------------------

def test_haversine_known_distance():
    """Nairobi CBD to Ruiru is ~23 km; allow 1 km for the exact endpoints."""
    metres = geo.haversine_m(-1.286389, 36.817223, -1.1500, 36.9600)
    assert 20_000 < metres < 26_000


def test_haversine_is_zero_for_the_same_point():
    assert geo.haversine_m(-1.28, 36.81, -1.28, 36.81) == 0.0


def test_haversine_tolerates_missing_coordinates():
    assert geo.haversine_m(None, 36.81, -1.28, 36.81) == 0.0


def test_path_length_follows_the_route_not_the_straight_line():
    """A dog-leg is longer than its endpoints suggest — the whole reason we
    store a drawn path rather than two pins."""
    straight = geo.haversine_m(0, 0, 0, 0.02)
    dogleg = geo.path_length_m([[0, 0], [0.01, 0.01], [0, 0.02]])
    assert dogleg > straight


@pytest.mark.parametrize('raw', ['', None, 'not json', '{}', '[1,2,3]', '[[1]]'])
def test_parse_path_never_raises_on_junk(raw):
    assert geo.parse_path(raw) == []


def test_parse_path_round_trips():
    points = [[-1.28, 36.81], [-1.29, 36.82]]
    assert geo.parse_path(geo.serialize_path(points)) == points


def test_bounds_of_points():
    assert geo.bounds_of([(1, 2), (3, 4), (None, None)]) == [[1, 2], [3, 4]]
    assert geo.bounds_of([]) is None


# --- the tree ---------------------------------------------------------------

def test_walk_upstream_reaches_the_olt():
    nodes = [node(1, 'olt'), node(2, 'splitter', parent=1), node(3, 'odb', parent=2)]
    by_id, _ = geo.build_index(nodes)
    chain = geo.walk_upstream(by_id[3], by_id)
    assert [n.id for n in chain] == [3, 2, 1]


def test_walk_upstream_survives_a_parent_cycle():
    """Bad data must not hang a request — every map load walks these chains."""
    a, b = node(1, 'odb', parent=2), node(2, 'odb', parent=1)
    by_id, _ = geo.build_index([a, b])
    assert len(geo.walk_upstream(a, by_id)) <= 2


def test_descendants_collects_the_whole_subtree():
    nodes = [node(1, 'olt'), node(2, 'splitter', parent=1),
             node(3, 'odb', parent=2), node(4, 'odb', parent=2)]
    _, children = geo.build_index(nodes)
    assert sorted(n.id for n in geo.descendants(1, children)) == [2, 3, 4]


# --- loss budget ------------------------------------------------------------

def test_splitter_loss_falls_back_to_the_ratio_table():
    assert geo.splitter_loss(node(1, 'splitter', split_ratio='1:8')) == 10.5
    assert geo.splitter_loss(node(1, 'splitter', split_ratio='1:32')) == 17.0
    assert geo.splitter_loss(node(1, 'odb')) == 0.0


def test_measured_splitter_loss_beats_the_table():
    assert geo.splitter_loss(node(1, 'splitter', split_ratio='1:8', loss=9.8)) == 9.8


def test_predicted_power_drops_with_distance():
    """The same split further out must predict a lower number, or the budget
    cannot distinguish a long run from a fault."""
    nodes = [node(1, 'olt'), node(2, 'splitter', parent=1, split_ratio='1:8'),
             node(3, 'odb', parent=2)]
    by_id, _ = geo.build_index(nodes)

    near = geo.predict_rx_dbm(node(3, 'odb', parent=2), by_id,
                              geo.cable_index_for([cable(1, 2, 200), cable(2, 3, 100)]))[0]
    far = geo.predict_rx_dbm(node(3, 'odb', parent=2), by_id,
                             geo.cable_index_for([cable(1, 2, 8000), cable(2, 3, 4000)]))[0]
    assert far < near


def test_bigger_split_predicts_less_power():
    small = [node(1, 'olt'), node(2, 'splitter', parent=1, split_ratio='1:8'), node(3, 'odb', parent=2)]
    big = [node(1, 'olt'), node(2, 'splitter', parent=1, split_ratio='1:32'), node(3, 'odb', parent=2)]
    idx = geo.cable_index_for([cable(1, 2, 1000), cable(2, 3, 500)])
    small_rx = geo.predict_rx_dbm(small[2], geo.build_index(small)[0], idx)[0]
    big_rx = geo.predict_rx_dbm(big[2], geo.build_index(big)[0], idx)[0]
    assert big_rx < small_rx
    # 1:32 costs ~6.5 dB more than 1:8 — the table difference, not a guess.
    assert round(small_rx - big_rx, 1) == 6.5


def test_loss_breakdown_terms_sum_to_the_total():
    """The panel shows the terms separately; they must add up or it misleads."""
    nodes = [node(1, 'olt'), node(2, 'splitter', parent=1, split_ratio='1:16'), node(3, 'odb', parent=2)]
    by_id, _ = geo.build_index(nodes)
    idx = geo.cable_index_for([cable(1, 2, 3000, slack_m=50), cable(2, 3, 800)])
    predicted, terms = geo.predict_rx_dbm(nodes[2], by_id, idx)
    parts = terms['fiber_db'] + terms['splitter_db'] + terms['connector_db'] + terms['splice_db']
    assert round(parts, 2) == terms['total_loss_db']
    assert round(terms['olt_tx_dbm'] - terms['total_loss_db'], 2) == predicted


def test_slack_counts_toward_fiber_loss():
    nodes = [node(1, 'olt'), node(2, 'odb', parent=1)]
    by_id, _ = geo.build_index(nodes)
    without = geo.predict_rx_dbm(nodes[1], by_id, geo.cable_index_for([cable(1, 2, 1000)]))[0]
    with_slack = geo.predict_rx_dbm(nodes[1], by_id,
                                    geo.cable_index_for([cable(1, 2, 1000, slack_m=500)]))[0]
    assert with_slack < without


@pytest.mark.parametrize('dbm,expected', [
    (-5, 'too_strong'), (-8, 'too_strong'), (-20, 'good'), (-25, 'good'),
    (-26, 'marginal'), (-27, 'marginal'), (-28, 'critical'), (None, None),
])
def test_optical_health_bands_match_the_acs(dbm, expected):
    """Deliberately identical to routes/cpe.py::_optical_health — a map and a
    device page disagreeing about the same reading would be worse than either."""
    assert geo.optical_health(dbm) == expected


# --- fault localisation -----------------------------------------------------

def test_a_whole_branch_going_bad_implicates_its_node():
    nodes = [node(1, 'olt'), node(2, 'splitter', parent=1), node(3, 'odb', parent=2)]
    onts = [ont(1, 3, -28.5), ont(2, 3, -29.0), ont(3, 3, -28.0)]
    suspects = geo.localise_faults(nodes, onts)
    assert suspects, 'a fully degraded branch should raise a suspect'
    assert suspects[0]['node_id'] == 3        # deepest node that explains it
    assert suspects[0]['affected'] == 3


def test_one_bad_ont_among_healthy_ones_is_not_a_branch_fault():
    """That is a drop cable or the premises — sending a van to the ODB is wrong."""
    nodes = [node(1, 'olt'), node(2, 'odb', parent=1)]
    onts = [ont(1, 2, -28.5), ont(2, 2, -20.0), ont(3, 2, -21.0), ont(4, 2, -19.5)]
    assert geo.localise_faults(nodes, onts) == []


def test_a_single_degraded_ont_is_below_the_reporting_floor():
    nodes = [node(1, 'olt'), node(2, 'odb', parent=1)]
    assert geo.localise_faults(nodes, [ont(1, 2, -29.0)]) == []


def test_deepest_suspect_is_ranked_first():
    """The ODB and the splitter above it both look guilty; the ODB is the one
    to visit."""
    nodes = [node(1, 'olt'), node(2, 'splitter', parent=1), node(3, 'odb', parent=2)]
    onts = [ont(1, 3, -28.5), ont(2, 3, -29.0)]
    suspects = geo.localise_faults(nodes, onts)
    assert suspects[0]['depth'] >= suspects[-1]['depth']
    assert suspects[0]['node_id'] == 3


def test_onts_without_readings_are_ignored():
    nodes = [node(1, 'olt'), node(2, 'odb', parent=1)]
    assert geo.localise_faults(nodes, [ont(1, 2, None), ont(2, 2, None)]) == []


# --- ports ------------------------------------------------------------------

def test_port_occupancy_is_derived_from_splice_rows():
    target = node(1, 'odb', ports=8)
    splices = [
        SimpleNamespace(node_id=1, port_number=1, status='in_use'),
        SimpleNamespace(node_id=1, port_number=4, status='reserved'),
        SimpleNamespace(node_id=1, port_number=7, status='spare'),   # not occupied
        SimpleNamespace(node_id=2, port_number=1, status='in_use'),  # another node
    ]
    occupancy = geo.port_occupancy(target, splices)
    assert occupancy == {'total': 8, 'used': 2, 'free': 6, 'used_ports': [1, 4]}


def test_port_occupancy_without_a_declared_count():
    occupancy = geo.port_occupancy(node(1, 'odb'), [])
    assert occupancy['total'] == 0 and occupancy['free'] is None
