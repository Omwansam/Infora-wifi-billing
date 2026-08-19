"""Operator API for the fiber plant and its map.

The plant is a tree rooted at an OLT. Most endpoints here are ordinary CRUD;
the ones that earn their keep are ``/map`` (everything drawable in one request,
because a map that fires six requests judders while it loads) and ``/faults``
(the branch analysis that turns optical readings into a place to send a van).
"""
import json
from datetime import datetime

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from auth_utils import get_current_user
from extensions import db
from models import CpeDevice, Customer, FiberCable, FiberNode, FiberSplice, ISP
from services import fiber_geo, fiber_import
from services.geocoding import geocode_customers

fiber_bp = Blueprint('fiber', __name__, url_prefix='/api/fiber')

MAX_UPLOAD_BYTES = 8 * 1024 * 1024


# ---------------------------------------------------------------------------
#  Scoping
# ---------------------------------------------------------------------------

def _isp_id():
    """Tenant for this request, or None when the account has no ISP."""
    user = get_current_user()
    if not user:
        return None
    if getattr(user, 'isp_id', None):
        return user.isp_id
    if user.role == 'admin':
        isp = ISP.query.filter_by(is_active=True).order_by(ISP.id.asc()).first()
        return isp.id if isp else None
    return None


def _owned(model, obj_id, isp_id):
    return model.query.filter_by(id=obj_id, isp_id=isp_id).first()


def _f(value):
    """Float or None — form values arrive as '' more often than as null."""
    if value is None or value == '':
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _i(value):
    if value is None or value == '':
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------------------
#  Serialisers
# ---------------------------------------------------------------------------

def serialize_node(node, occupancy=None):
    data = {
        'id': node.id,
        'name': node.name,
        'code': node.code,
        'kind': node.kind,
        'latitude': node.latitude,
        'longitude': node.longitude,
        'placed': node.latitude is not None and node.longitude is not None,
        'parent_id': node.parent_id,
        'port_count': node.port_count,
        'split_ratio': node.split_ratio,
        'splitter_loss_db': node.splitter_loss_db,
        'status': node.status,
        'address': node.address,
        'notes': node.notes,
        'zone_id': node.zone_id,
        'device_id': node.device_id,
        'created_at': node.created_at.isoformat() if node.created_at else None,
    }
    if occupancy is not None:
        data['ports'] = occupancy
    return data


def serialize_cable(cable):
    return {
        'id': cable.id,
        'name': cable.name,
        'cable_type': cable.cable_type,
        'from_node_id': cable.from_node_id,
        'to_node_id': cable.to_node_id,
        'fiber_count': cable.fiber_count,
        'length_m': cable.length_m,
        'slack_m': cable.slack_m,
        'path': fiber_geo.parse_path(cable.path),
        'installation': cable.installation,
        'status': cable.status,
        'notes': cable.notes,
    }


def serialize_splice(splice):
    return {
        'id': splice.id,
        'node_id': splice.node_id,
        'port_number': splice.port_number,
        'cable_id': splice.cable_id,
        'fiber_number': splice.fiber_number,
        'tube_color': splice.tube_color,
        'fiber_color': splice.fiber_color,
        'downstream_node_id': splice.downstream_node_id,
        'customer_id': splice.customer_id,
        'customer_name': splice.customer.full_name if splice.customer else None,
        'cpe_device_id': splice.cpe_device_id,
        'status': splice.status,
        'loss_db': splice.loss_db,
        'spliced_at': splice.spliced_at.isoformat() if splice.spliced_at else None,
        'notes': splice.notes,
    }


# ---------------------------------------------------------------------------
#  The map payload
# ---------------------------------------------------------------------------

@fiber_bp.route('/map', methods=['GET'])
@jwt_required()
def fiber_map():
    """Everything drawable, in one request.

    Deliberately one call rather than four: the map cannot render usefully until
    it has all layers, and staggered responses make it jump as each arrives.
    """
    isp_id = _isp_id()
    if not isp_id:
        return jsonify({'error': 'No ISP associated with this account'}), 404

    nodes = FiberNode.query.filter_by(isp_id=isp_id).all()
    cables = FiberCable.query.filter_by(isp_id=isp_id).all()
    splices = FiberSplice.query.filter_by(isp_id=isp_id).all()

    onts = (CpeDevice.query.filter(CpeDevice.isp_id == isp_id).all())
    customers = (Customer.query
                 .filter(Customer.isp_id == isp_id,
                         Customer.latitude.isnot(None),
                         Customer.longitude.isnot(None))
                 .all())

    by_id, _children = fiber_geo.build_index(nodes)
    cable_index = fiber_geo.cable_index_for(cables)

    node_payload = []
    for node in nodes:
        node_payload.append(serialize_node(node, fiber_geo.port_occupancy(node, splices)))

    ont_payload = []
    for ont in onts:
        # Predicted vs measured is the diagnostic: it separates "far away, so a
        # low reading is expected" from "should be fine, and is not".
        predicted = None
        if ont.fiber_node_id and ont.fiber_node_id in by_id:
            predicted, _ = fiber_geo.predict_rx_dbm(by_id[ont.fiber_node_id], by_id, cable_index)
        discrepancy = (round(ont.rx_power_dbm - predicted, 2)
                       if predicted is not None and ont.rx_power_dbm is not None else None)
        ont_payload.append({
            'id': ont.id,
            'serial_number': ont.serial_number,
            'latitude': ont.latitude,
            'longitude': ont.longitude,
            'customer_id': ont.customer_id,
            'customer_name': ont.customer.full_name if ont.customer else None,
            'fiber_node_id': ont.fiber_node_id,
            'rx_power_dbm': ont.rx_power_dbm,
            'optical_health': fiber_geo.optical_health(ont.rx_power_dbm),
            'predicted_rx_dbm': predicted,
            'discrepancy_db': discrepancy,
            'online': bool(ont.last_inform_at),
            'status': ont.status,
        })

    customer_payload = [{
        'id': c.id,
        'name': c.full_name,
        'latitude': c.latitude,
        'longitude': c.longitude,
        'geo_source': c.geo_source,
        'status': c.status.value if hasattr(c.status, 'value') else str(c.status),
        'connection_type': c.connection_type,
        'package': c.package,
    } for c in customers]

    points = ([(n.latitude, n.longitude) for n in nodes]
              + [(o.latitude, o.longitude) for o in onts]
              + [(c.latitude, c.longitude) for c in customers])

    return jsonify({
        'nodes': node_payload,
        'cables': [serialize_cable(c) for c in cables],
        'onts': ont_payload,
        'customers': customer_payload,
        'bounds': fiber_geo.bounds_of(points),
        'stats': {
            'nodes': len(nodes),
            'placed_nodes': sum(1 for n in nodes if n.latitude is not None),
            'cables': len(cables),
            'cable_length_m': round(sum(c.length_m or 0 for c in cables), 1),
            'onts_mapped': sum(1 for o in onts if o.latitude is not None),
            'onts_total': len(onts),
            'customers_mapped': len(customer_payload),
        },
    }), 200


@fiber_bp.route('/faults', methods=['GET'])
@jwt_required()
def fiber_faults():
    """Which node each cluster of degraded ONTs points at, deepest first."""
    isp_id = _isp_id()
    if not isp_id:
        return jsonify({'error': 'No ISP associated with this account'}), 404

    nodes = FiberNode.query.filter_by(isp_id=isp_id).all()
    onts = CpeDevice.query.filter(CpeDevice.isp_id == isp_id,
                                  CpeDevice.fiber_node_id.isnot(None)).all()
    min_affected = _i(request.args.get('min_affected')) or 2
    return jsonify({'suspects': fiber_geo.localise_faults(nodes, onts, min_affected)}), 200


@fiber_bp.route('/nodes/<int:node_id>/trace', methods=['GET'])
@jwt_required()
def trace_node(node_id):
    """Upstream path to the OLT with the loss budget broken out per term."""
    isp_id = _isp_id()
    node = _owned(FiberNode, node_id, isp_id) if isp_id else None
    if node is None:
        return jsonify({'error': 'Node not found'}), 404

    nodes = FiberNode.query.filter_by(isp_id=isp_id).all()
    cables = FiberCable.query.filter_by(isp_id=isp_id).all()
    by_id, children = fiber_geo.build_index(nodes)
    cable_index = fiber_geo.cable_index_for(cables)

    chain = fiber_geo.walk_upstream(node, by_id)
    predicted, breakdown = fiber_geo.predict_rx_dbm(node, by_id, cable_index)
    below = fiber_geo.descendants(node.id, children)
    onts = CpeDevice.query.filter(
        CpeDevice.isp_id == isp_id,
        CpeDevice.fiber_node_id.in_([node.id] + [n.id for n in below] or [node.id]),
    ).all()

    return jsonify({
        'node': serialize_node(node),
        'upstream': [serialize_node(n) for n in chain],
        'predicted_rx_dbm': predicted,
        'loss_breakdown': breakdown,
        'sensitivity_dbm': fiber_geo.ONT_SENSITIVITY_DBM,
        'within_budget': (predicted is not None
                          and predicted > fiber_geo.ONT_SENSITIVITY_DBM),
        'descendant_count': len(below),
        'onts': [{
            'id': o.id, 'serial_number': o.serial_number,
            'rx_power_dbm': o.rx_power_dbm,
            'optical_health': fiber_geo.optical_health(o.rx_power_dbm),
            'customer_name': o.customer.full_name if o.customer else None,
        } for o in onts],
    }), 200


# ---------------------------------------------------------------------------
#  Nodes
# ---------------------------------------------------------------------------

@fiber_bp.route('/nodes', methods=['GET'])
@jwt_required()
def list_nodes():
    isp_id = _isp_id()
    if not isp_id:
        return jsonify({'error': 'No ISP associated with this account'}), 404

    query = FiberNode.query.filter_by(isp_id=isp_id)
    kind = request.args.get('kind')
    if kind and kind != 'all':
        query = query.filter_by(kind=kind)
    search = (request.args.get('search') or '').strip()
    if search:
        like = f'%{search}%'
        query = query.filter(db.or_(FiberNode.name.ilike(like), FiberNode.code.ilike(like)))

    nodes = query.order_by(FiberNode.kind, FiberNode.name).all()
    splices = FiberSplice.query.filter_by(isp_id=isp_id).all()
    return jsonify({'nodes': [serialize_node(n, fiber_geo.port_occupancy(n, splices))
                              for n in nodes]}), 200


@fiber_bp.route('/nodes', methods=['POST'])
@jwt_required()
def create_node():
    isp_id = _isp_id()
    if not isp_id:
        return jsonify({'error': 'No ISP associated with this account'}), 404
    data = request.get_json(silent=True) or {}

    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'name is required'}), 400
    kind = (data.get('kind') or 'odb').strip()
    if kind not in FiberNode.KINDS:
        return jsonify({'error': f'kind must be one of {", ".join(FiberNode.KINDS)}'}), 400

    node = FiberNode(
        isp_id=isp_id, name=name[:120], kind=kind,
        code=(data.get('code') or '').strip()[:60] or None,
        latitude=_f(data.get('latitude')), longitude=_f(data.get('longitude')),
        parent_id=_i(data.get('parent_id')),
        port_count=_i(data.get('port_count')),
        split_ratio=(data.get('split_ratio') or '').strip() or None,
        splitter_loss_db=_f(data.get('splitter_loss_db')),
        status=(data.get('status') or 'active'),
        address=(data.get('address') or '').strip()[:255] or None,
        notes=(data.get('notes') or '').strip() or None,
        zone_id=_i(data.get('zone_id')), device_id=_i(data.get('device_id')),
    )
    db.session.add(node)
    db.session.commit()
    return jsonify({'message': 'Node created', 'node': serialize_node(node)}), 201


@fiber_bp.route('/nodes/<int:node_id>', methods=['PUT'])
@jwt_required()
def update_node(node_id):
    isp_id = _isp_id()
    node = _owned(FiberNode, node_id, isp_id) if isp_id else None
    if node is None:
        return jsonify({'error': 'Node not found'}), 404
    data = request.get_json(silent=True) or {}

    if 'parent_id' in data:
        parent_id = _i(data.get('parent_id'))
        if parent_id == node.id:
            return jsonify({'error': 'A node cannot be its own parent'}), 400
        # Walk up from the proposed parent; if we meet this node the edit would
        # create a cycle, which would make every upstream trace loop.
        if parent_id:
            seen, cursor = set(), FiberNode.query.get(parent_id)
            while cursor is not None and cursor.id not in seen:
                if cursor.id == node.id:
                    return jsonify({'error': 'That parent is downstream of this node'}), 400
                seen.add(cursor.id)
                cursor = FiberNode.query.get(cursor.parent_id) if cursor.parent_id else None
        node.parent_id = parent_id

    for field in ('name', 'code', 'address', 'notes', 'status', 'split_ratio'):
        if field in data:
            value = data.get(field)
            setattr(node, field, (value or '').strip() or None if isinstance(value, str) else value)
    if 'kind' in data and data['kind'] in FiberNode.KINDS:
        node.kind = data['kind']
    for field in ('latitude', 'longitude', 'splitter_loss_db'):
        if field in data:
            setattr(node, field, _f(data.get(field)))
    for field in ('port_count', 'zone_id', 'device_id'):
        if field in data:
            setattr(node, field, _i(data.get(field)))
    if not node.name:
        return jsonify({'error': 'name cannot be empty'}), 400

    db.session.commit()
    return jsonify({'message': 'Node updated', 'node': serialize_node(node)}), 200


@fiber_bp.route('/nodes/<int:node_id>', methods=['DELETE'])
@jwt_required()
def delete_node(node_id):
    isp_id = _isp_id()
    node = _owned(FiberNode, node_id, isp_id) if isp_id else None
    if node is None:
        return jsonify({'error': 'Node not found'}), 404

    # Refuse rather than silently orphan a branch — deleting a splitter would
    # otherwise detach everything under it with no way to tell what was lost.
    child_count = FiberNode.query.filter_by(parent_id=node.id).count()
    if child_count:
        return jsonify({
            'error': f'{child_count} node(s) feed from this one. Re-parent them first.',
        }), 409

    FiberSplice.query.filter_by(node_id=node.id).delete(synchronize_session=False)
    FiberCable.query.filter(db.or_(FiberCable.from_node_id == node.id,
                                   FiberCable.to_node_id == node.id)).delete(
        synchronize_session=False)
    CpeDevice.query.filter_by(fiber_node_id=node.id).update({'fiber_node_id': None},
                                                            synchronize_session=False)
    db.session.delete(node)
    db.session.commit()
    return jsonify({'message': 'Node deleted'}), 200


# ---------------------------------------------------------------------------
#  Cables
# ---------------------------------------------------------------------------

@fiber_bp.route('/cables', methods=['GET'])
@jwt_required()
def list_cables():
    isp_id = _isp_id()
    if not isp_id:
        return jsonify({'error': 'No ISP associated with this account'}), 404
    cables = FiberCable.query.filter_by(isp_id=isp_id).order_by(FiberCable.cable_type).all()
    return jsonify({'cables': [serialize_cable(c) for c in cables]}), 200


@fiber_bp.route('/cables', methods=['POST'])
@jwt_required()
def create_cable():
    isp_id = _isp_id()
    if not isp_id:
        return jsonify({'error': 'No ISP associated with this account'}), 404
    data = request.get_json(silent=True) or {}

    from_id = _i(data.get('from_node_id'))
    if not from_id or not _owned(FiberNode, from_id, isp_id):
        return jsonify({'error': 'from_node_id must be one of your nodes'}), 400
    to_id = _i(data.get('to_node_id'))
    if to_id and not _owned(FiberNode, to_id, isp_id):
        return jsonify({'error': 'to_node_id must be one of your nodes'}), 400

    path = fiber_geo.parse_path(data.get('path'))
    cable = FiberCable(
        isp_id=isp_id,
        name=(data.get('name') or '').strip()[:120] or None,
        cable_type=(data.get('cable_type') or 'distribution'),
        from_node_id=from_id, to_node_id=to_id,
        fiber_count=_i(data.get('fiber_count')),
        slack_m=_f(data.get('slack_m')),
        path=fiber_geo.serialize_path(path) if path else None,
        # Always server-computed: a client-supplied length is how inventory
        # quietly stops matching the map.
        length_m=round(fiber_geo.path_length_m(path), 1) if path else None,
        installation=(data.get('installation') or 'aerial'),
        status=(data.get('status') or 'active'),
        notes=(data.get('notes') or '').strip() or None,
    )
    db.session.add(cable)
    db.session.commit()
    return jsonify({'message': 'Cable created', 'cable': serialize_cable(cable)}), 201


@fiber_bp.route('/cables/<int:cable_id>', methods=['PUT'])
@jwt_required()
def update_cable(cable_id):
    isp_id = _isp_id()
    cable = _owned(FiberCable, cable_id, isp_id) if isp_id else None
    if cable is None:
        return jsonify({'error': 'Cable not found'}), 404
    data = request.get_json(silent=True) or {}

    if 'path' in data:
        path = fiber_geo.parse_path(data.get('path'))
        cable.path = fiber_geo.serialize_path(path) if path else None
        cable.length_m = round(fiber_geo.path_length_m(path), 1) if path else None
    for field in ('name', 'cable_type', 'installation', 'status', 'notes'):
        if field in data:
            value = data.get(field)
            setattr(cable, field, (value or '').strip() or None if isinstance(value, str) else value)
    for field in ('from_node_id', 'to_node_id', 'fiber_count'):
        if field in data:
            setattr(cable, field, _i(data.get(field)))
    if 'slack_m' in data:
        cable.slack_m = _f(data.get('slack_m'))

    db.session.commit()
    return jsonify({'message': 'Cable updated', 'cable': serialize_cable(cable)}), 200


@fiber_bp.route('/cables/<int:cable_id>', methods=['DELETE'])
@jwt_required()
def delete_cable(cable_id):
    isp_id = _isp_id()
    cable = _owned(FiberCable, cable_id, isp_id) if isp_id else None
    if cable is None:
        return jsonify({'error': 'Cable not found'}), 404
    FiberSplice.query.filter_by(cable_id=cable.id).update({'cable_id': None},
                                                          synchronize_session=False)
    db.session.delete(cable)
    db.session.commit()
    return jsonify({'message': 'Cable deleted'}), 200


# ---------------------------------------------------------------------------
#  Splice plan
# ---------------------------------------------------------------------------

@fiber_bp.route('/nodes/<int:node_id>/splices', methods=['GET'])
@jwt_required()
def list_splices(node_id):
    """The port sheet for one node: every port, occupied or free."""
    isp_id = _isp_id()
    node = _owned(FiberNode, node_id, isp_id) if isp_id else None
    if node is None:
        return jsonify({'error': 'Node not found'}), 404

    splices = FiberSplice.query.filter_by(node_id=node.id).order_by(
        FiberSplice.port_number).all()
    used = {s.port_number: s for s in splices}
    ports = [{
        'port_number': n,
        'splice': serialize_splice(used[n]) if n in used else None,
    } for n in range(1, (node.port_count or 0) + 1)]
    # Ports recorded beyond the declared count still show — a miscounted tray
    # must not hide a live subscriber.
    for number, splice in used.items():
        if number > (node.port_count or 0):
            ports.append({'port_number': number, 'splice': serialize_splice(splice)})

    return jsonify({
        'node': serialize_node(node, fiber_geo.port_occupancy(node, splices)),
        'ports': sorted(ports, key=lambda p: p['port_number']),
    }), 200


@fiber_bp.route('/splices', methods=['POST'])
@jwt_required()
def create_splice():
    isp_id = _isp_id()
    if not isp_id:
        return jsonify({'error': 'No ISP associated with this account'}), 404
    data = request.get_json(silent=True) or {}

    node_id = _i(data.get('node_id'))
    node = _owned(FiberNode, node_id, isp_id) if node_id else None
    if node is None:
        return jsonify({'error': 'node_id must be one of your nodes'}), 400
    port_number = _i(data.get('port_number'))
    if not port_number or port_number < 1:
        return jsonify({'error': 'port_number is required'}), 400
    if FiberSplice.query.filter_by(node_id=node.id, port_number=port_number).first():
        return jsonify({'error': f'Port {port_number} on {node.name} is already assigned'}), 409

    splice = FiberSplice(
        isp_id=isp_id, node_id=node.id, port_number=port_number,
        cable_id=_i(data.get('cable_id')), fiber_number=_i(data.get('fiber_number')),
        tube_color=(data.get('tube_color') or '').strip() or None,
        fiber_color=(data.get('fiber_color') or '').strip() or None,
        downstream_node_id=_i(data.get('downstream_node_id')),
        customer_id=_i(data.get('customer_id')),
        cpe_device_id=_i(data.get('cpe_device_id')),
        status=(data.get('status') or 'in_use'),
        loss_db=_f(data.get('loss_db')),
        spliced_at=datetime.utcnow(),
        notes=(data.get('notes') or '').strip() or None,
    )
    db.session.add(splice)

    # Assigning a subscriber's ONT to a port is also what tells the fault
    # analysis which branch that ONT hangs off.
    if splice.cpe_device_id:
        cpe = CpeDevice.query.filter_by(id=splice.cpe_device_id, isp_id=isp_id).first()
        if cpe:
            cpe.fiber_node_id = node.id

    db.session.commit()
    return jsonify({'message': 'Port assigned', 'splice': serialize_splice(splice)}), 201


@fiber_bp.route('/splices/<int:splice_id>', methods=['PUT'])
@jwt_required()
def update_splice(splice_id):
    isp_id = _isp_id()
    splice = _owned(FiberSplice, splice_id, isp_id) if isp_id else None
    if splice is None:
        return jsonify({'error': 'Splice not found'}), 404
    data = request.get_json(silent=True) or {}

    for field in ('tube_color', 'fiber_color', 'status', 'notes'):
        if field in data:
            value = data.get(field)
            setattr(splice, field, (value or '').strip() or None if isinstance(value, str) else value)
    for field in ('cable_id', 'fiber_number', 'downstream_node_id',
                  'customer_id', 'cpe_device_id'):
        if field in data:
            setattr(splice, field, _i(data.get(field)))
    if 'loss_db' in data:
        splice.loss_db = _f(data.get('loss_db'))

    if splice.cpe_device_id:
        cpe = CpeDevice.query.filter_by(id=splice.cpe_device_id, isp_id=isp_id).first()
        if cpe:
            cpe.fiber_node_id = splice.node_id

    db.session.commit()
    return jsonify({'message': 'Port updated', 'splice': serialize_splice(splice)}), 200


@fiber_bp.route('/splices/<int:splice_id>', methods=['DELETE'])
@jwt_required()
def delete_splice(splice_id):
    isp_id = _isp_id()
    splice = _owned(FiberSplice, splice_id, isp_id) if isp_id else None
    if splice is None:
        return jsonify({'error': 'Splice not found'}), 404
    if splice.cpe_device_id:
        cpe = CpeDevice.query.filter_by(id=splice.cpe_device_id, isp_id=isp_id).first()
        if cpe and cpe.fiber_node_id == splice.node_id:
            cpe.fiber_node_id = None
    db.session.delete(splice)
    db.session.commit()
    return jsonify({'message': 'Port cleared'}), 200


# ---------------------------------------------------------------------------
#  Placing things
# ---------------------------------------------------------------------------

@fiber_bp.route('/place', methods=['POST'])
@jwt_required()
def place_entity():
    """Pin a customer or an ONT from the map. {kind, id, latitude, longitude}"""
    isp_id = _isp_id()
    if not isp_id:
        return jsonify({'error': 'No ISP associated with this account'}), 404
    data = request.get_json(silent=True) or {}

    lat, lng = _f(data.get('latitude')), _f(data.get('longitude'))
    if lat is None or lng is None:
        return jsonify({'error': 'latitude and longitude are required'}), 400
    if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
        return jsonify({'error': 'Coordinates are out of range'}), 400

    kind = (data.get('kind') or '').strip()
    target_id = _i(data.get('id'))

    if kind == 'customer':
        target = Customer.query.filter_by(id=target_id, isp_id=isp_id).first()
        if target is None:
            return jsonify({'error': 'Customer not found'}), 404
        target.latitude, target.longitude = lat, lng
        target.geo_source = 'manual'
        target.geo_updated_at = datetime.utcnow()
    elif kind == 'ont':
        target = CpeDevice.query.filter_by(id=target_id, isp_id=isp_id).first()
        if target is None:
            return jsonify({'error': 'ONT not found'}), 404
        target.latitude, target.longitude = lat, lng
    elif kind == 'node':
        target = _owned(FiberNode, target_id, isp_id)
        if target is None:
            return jsonify({'error': 'Node not found'}), 404
        target.latitude, target.longitude = lat, lng
    else:
        return jsonify({'error': 'kind must be customer, ont or node'}), 400

    db.session.commit()
    return jsonify({'message': 'Placed', 'latitude': lat, 'longitude': lng}), 200


@fiber_bp.route('/geocode', methods=['POST'])
@jwt_required()
def geocode_batch():
    """Bulk-place subscribers from their address text (rate-limited upstream)."""
    isp_id = _isp_id()
    if not isp_id:
        return jsonify({'error': 'No ISP associated with this account'}), 404
    data = request.get_json(silent=True) or {}
    limit = min(_i(data.get('limit')) or 25, 50)

    pending = (Customer.query
               .filter(Customer.isp_id == isp_id,
                       Customer.latitude.is_(None),
                       Customer.address.isnot(None))
               .limit(limit * 2).all())
    if not pending:
        return jsonify({'message': 'Every subscriber with an address is already placed',
                        'placed': 0, 'skipped': 0, 'failed': [], 'remaining': 0}), 200

    result = geocode_customers(pending, limit=limit, country=data.get('country'))
    remaining = (Customer.query
                 .filter(Customer.isp_id == isp_id,
                         Customer.latitude.is_(None),
                         Customer.address.isnot(None)).count())
    result['remaining'] = remaining
    result['message'] = (f"Placed {result['placed']} subscriber(s); "
                         f'{remaining} still unplaced.')
    return jsonify(result), 200


@fiber_bp.route('/import', methods=['POST'])
@jwt_required()
def import_survey():
    """Import a KML or GeoJSON survey. Send ?dry_run=1 to preview first."""
    isp_id = _isp_id()
    if not isp_id:
        return jsonify({'error': 'No ISP associated with this account'}), 404

    upload = request.files.get('file')
    filename, raw = None, None
    if upload is not None:
        filename = upload.filename
        raw = upload.read(MAX_UPLOAD_BYTES + 1)
        if len(raw) > MAX_UPLOAD_BYTES:
            return jsonify({'error': 'File is larger than 8 MB'}), 413
        raw = raw.decode('utf-8', errors='replace')
    else:
        body = request.get_json(silent=True) or {}
        filename = body.get('filename')
        raw = body.get('content')
    if not raw:
        return jsonify({'error': 'No file content received'}), 400

    try:
        parsed = fiber_import.parse_any(filename, raw)
    except fiber_import.ImportError_ as exc:
        return jsonify({'error': str(exc)}), 400

    dry_run = request.args.get('dry_run') in ('1', 'true', 'yes')
    summary = fiber_import.commit_import(isp_id, parsed, dry_run=dry_run)
    summary['message'] = (
        f"Preview: {summary['nodes']} node(s), {summary['cables']} cable(s)."
        if dry_run else
        f"Imported {summary['nodes']} node(s) and {summary['cables']} cable(s). "
        'They land as "planned" and unattached — connect them to your plant on the map.'
    )
    return jsonify(summary), 200 if dry_run else 201


@fiber_bp.route('/stats', methods=['GET'])
@jwt_required()
def fiber_stats():
    isp_id = _isp_id()
    if not isp_id:
        return jsonify({'error': 'No ISP associated with this account'}), 404

    nodes = FiberNode.query.filter_by(isp_id=isp_id).all()
    cables = FiberCable.query.filter_by(isp_id=isp_id).all()
    splices = FiberSplice.query.filter_by(isp_id=isp_id).all()

    by_kind = {}
    for node in nodes:
        by_kind[node.kind] = by_kind.get(node.kind, 0) + 1

    capacity = sum(n.port_count or 0 for n in nodes if n.kind in ('splitter', 'odb'))
    used = len({(s.node_id, s.port_number) for s in splices if s.status != 'spare'})

    return jsonify({
        'nodes': len(nodes),
        'nodes_by_kind': by_kind,
        'unplaced_nodes': sum(1 for n in nodes if n.latitude is None),
        'cables': len(cables),
        'cable_length_km': round(sum(c.length_m or 0 for c in cables) / 1000.0, 2),
        'ports_total': capacity,
        'ports_used': used,
        'ports_free': max(0, capacity - used),
        'unplaced_customers': Customer.query.filter(
            Customer.isp_id == isp_id, Customer.latitude.is_(None)).count(),
    }), 200
