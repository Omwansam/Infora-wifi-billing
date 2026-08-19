"""Geometry, tree traversal and optical loss maths for the fiber plant.

The point of this module is the last part. Plotting nodes on a map is
presentation; comparing an ONT's *measured* receive power against what the
plant says it *should* be is diagnosis. A subscriber 6 km out on a 1:32 split
reading −24 dBm is healthy; one 400 m out on a 1:8 reading the same number has
a fault. Only the plant model can tell those apart.
"""
import json
import math
from collections import defaultdict

EARTH_RADIUS_M = 6_371_000.0

# --- Optical constants (ITU-T G.984 / G.657 planning figures) ---------------
# Attenuation of the fibre itself. GPON runs 1490 nm downstream, 1310 nm up;
# 0.30 dB/km is the usual planning figure that covers both with margin.
FIBER_ATTENUATION_DB_PER_KM = 0.30
# Manufacturer insertion loss per split. A node's own splitter_loss_db wins
# when set — these are the fallbacks for a splitter recorded only by ratio.
SPLITTER_LOSS_DB = {
    '1:2': 3.5, '1:4': 7.2, '1:8': 10.5,
    '1:16': 13.5, '1:32': 17.0, '1:64': 20.5,
}
CONNECTOR_LOSS_DB = 0.5   # per mated pair
SPLICE_LOSS_DB = 0.1      # per fusion splice
# Class B+ OLT launch power, dBm. Configurable per OLT node later.
DEFAULT_OLT_TX_DBM = 3.0
# Below this an ONT is out of spec for Class B+ regardless of distance.
ONT_SENSITIVITY_DBM = -27.0
# How far measured may drift from predicted before we call it a fault.
LOSS_DISCREPANCY_DB = 3.0


# ---------------------------------------------------------------------------
#  Geometry
# ---------------------------------------------------------------------------

def haversine_m(lat1, lng1, lat2, lng2):
    """Great-circle distance in metres. Accurate enough at plant scale."""
    if None in (lat1, lng1, lat2, lng2):
        return 0.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(min(1.0, math.sqrt(a)))


def parse_path(raw):
    """Cable geometry as [[lat, lng], ...]; tolerant of junk, never raises."""
    if not raw:
        return []
    try:
        data = json.loads(raw) if isinstance(raw, str) else raw
    except (TypeError, ValueError):
        return []
    if not isinstance(data, list):
        return []
    points = []
    for point in data:
        if isinstance(point, (list, tuple)) and len(point) >= 2:
            try:
                points.append([float(point[0]), float(point[1])])
            except (TypeError, ValueError):
                continue
    return points


def serialize_path(points):
    return json.dumps([[round(float(a), 7), round(float(b), 7)] for a, b in points])


def path_length_m(path):
    """Route length along the drawn line — not the straight-line distance.

    This is the number cable is ordered by, and a straight line between
    endpoints underestimates a real route badly.
    """
    points = parse_path(path)
    if len(points) < 2:
        return 0.0
    return sum(
        haversine_m(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1])
        for i in range(len(points) - 1)
    )


def bounds_of(points):
    """[[south, west], [north, east]] for fitting the map to content."""
    valid = [(a, b) for a, b in points if a is not None and b is not None]
    if not valid:
        return None
    lats = [p[0] for p in valid]
    lngs = [p[1] for p in valid]
    return [[min(lats), min(lngs)], [max(lats), max(lngs)]]


# ---------------------------------------------------------------------------
#  The tree
# ---------------------------------------------------------------------------

def build_index(nodes):
    """{id: node} plus {parent_id: [children]} — one pass, no N+1 queries."""
    by_id = {n.id: n for n in nodes}
    children = defaultdict(list)
    for node in nodes:
        if node.parent_id:
            children[node.parent_id].append(node)
    return by_id, children


def walk_upstream(node, by_id, max_depth=32):
    """Node → its OLT, nearest first. Depth-capped so a cycle cannot hang a request."""
    chain = []
    seen = set()
    current = node
    while current is not None and len(chain) < max_depth:
        if current.id in seen:
            break  # parent cycle in the data; stop rather than spin
        seen.add(current.id)
        chain.append(current)
        current = by_id.get(current.parent_id) if current.parent_id else None
    return chain


def descendants(node_id, children, max_nodes=5000):
    """Every node below this one, breadth-first."""
    out = []
    queue = list(children.get(node_id, []))
    seen = set()
    while queue and len(out) < max_nodes:
        node = queue.pop(0)
        if node.id in seen:
            continue
        seen.add(node.id)
        out.append(node)
        queue.extend(children.get(node.id, []))
    return out


# ---------------------------------------------------------------------------
#  Loss budget
# ---------------------------------------------------------------------------

def splitter_loss(node):
    """Insertion loss for one node. Measured value wins over the ratio table."""
    if node.splitter_loss_db is not None:
        return float(node.splitter_loss_db)
    if node.split_ratio:
        return SPLITTER_LOSS_DB.get(node.split_ratio.strip(), 0.0)
    return 0.0


def predict_rx_dbm(node, by_id, cable_index, olt_tx_dbm=DEFAULT_OLT_TX_DBM):
    """Predicted ONT receive power at `node`, and the terms that produced it.

    Returns (predicted_dbm, breakdown). The breakdown is returned because an
    operator staring at a bad number needs to see *which* term is large — a
    long run and an over-split PON look identical in the total alone.
    """
    chain = walk_upstream(node, by_id)
    if not chain:
        return None, {}

    fiber_m = 0.0
    split_db = 0.0
    connectors = 0
    splices = 0

    for hop in chain:
        # Cable feeding this hop from its parent.
        cable = cable_index.get((hop.parent_id, hop.id)) or cable_index.get((hop.id, hop.parent_id))
        if cable is not None:
            fiber_m += float(cable.length_m or 0) + float(cable.slack_m or 0)
            splices += 1
        if hop.kind in ('splitter', 'cabinet'):
            split_db += splitter_loss(hop)
            connectors += 1
        elif hop.kind == 'odb':
            connectors += 1

    # Round each term *before* summing. The UI prints these four lines above a
    # total, so a total derived from the unrounded values can disagree with the
    # numbers shown beneath it by a hundredth — which reads as a broken sum.
    fiber_db = round((fiber_m / 1000.0) * FIBER_ATTENUATION_DB_PER_KM, 2)
    connector_db = round(connectors * CONNECTOR_LOSS_DB, 2)
    splice_db = round(splices * SPLICE_LOSS_DB, 2)
    split_db = round(split_db, 2)
    total_loss = round(fiber_db + split_db + connector_db + splice_db, 2)

    return round(olt_tx_dbm - total_loss, 2), {
        'olt_tx_dbm': olt_tx_dbm,
        'fiber_m': round(fiber_m, 1),
        'fiber_db': fiber_db,
        'splitter_db': split_db,
        'connector_db': connector_db,
        'splice_db': splice_db,
        'total_loss_db': total_loss,
        'hops': len(chain),
    }


def optical_health(rx_dbm):
    """Same bands the ACS classifies on — kept identical on purpose."""
    if rx_dbm is None:
        return None
    if rx_dbm >= -8:
        return 'too_strong'
    if rx_dbm >= -25:
        return 'good'
    if rx_dbm >= -27:
        return 'marginal'
    return 'critical'


# ---------------------------------------------------------------------------
#  Fault localisation — the reason this is worth building
# ---------------------------------------------------------------------------

def localise_faults(nodes, cpe_devices, min_affected=2):
    """Find the node each cluster of degraded ONTs points at.

    One bad ONT under a healthy ODB is a drop-cable or premises problem. *Every*
    ONT under one ODB going bad at once is that ODB, its feed, or the splitter
    above it — one truck roll to a splice point instead of five to living rooms.

    Returns suspects deepest-first: the lowest node that explains the damage is
    the one to visit.
    """
    by_id, children = build_index(nodes)

    # Attach each ONT to its recorded node.
    onts_by_node = defaultdict(list)
    for cpe in cpe_devices:
        if cpe.fiber_node_id:
            onts_by_node[cpe.fiber_node_id].append(cpe)

    suspects = []
    for node in nodes:
        subtree = [node] + descendants(node.id, children)
        onts = [c for nid in (n.id for n in subtree) for c in onts_by_node.get(nid, [])]
        if len(onts) < min_affected:
            continue

        readings = [c.rx_power_dbm for c in onts if c.rx_power_dbm is not None]
        if not readings:
            continue
        degraded = [r for r in readings if optical_health(r) in ('marginal', 'critical')]
        if len(degraded) < min_affected:
            continue

        share = len(degraded) / len(readings)
        # Only a node whose whole subtree is suffering is evidence about *that*
        # node; a partial hit is better explained by something further down.
        if share < 0.8:
            continue

        suspects.append({
            'node_id': node.id,
            'node_name': node.name,
            'node_kind': node.kind,
            'latitude': node.latitude,
            'longitude': node.longitude,
            'affected': len(degraded),
            'total_onts': len(readings),
            'share': round(share, 2),
            'worst_dbm': min(readings),
            'depth': len(walk_upstream(node, by_id)),
        })

    # Deepest first: the most specific node that explains it.
    suspects.sort(key=lambda s: (-s['depth'], -s['affected']))
    return suspects


def cable_index_for(cables):
    """{(from_id, to_id): cable} for O(1) lookup while walking the tree."""
    return {(c.from_node_id, c.to_node_id): c for c in cables if c.to_node_id}


def port_occupancy(node, splices):
    """Used/free ports for a node, derived from splice rows — never a counter."""
    used = {s.port_number for s in splices if s.node_id == node.id and s.status != 'spare'}
    total = node.port_count or 0
    return {
        'total': total,
        'used': len(used),
        'free': max(0, total - len(used)) if total else None,
        'used_ports': sorted(used),
    }
