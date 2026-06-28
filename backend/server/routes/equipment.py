"""Equipment inventory API — physical asset & procurement tracking."""
from datetime import datetime

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required

from extensions import db
from auth_utils import get_current_user
from models import Equipment, ISP, MikrotikDevice

equipment_bp = Blueprint('equipment', __name__, url_prefix='/api/equipment')

VALID_STATUSES = {'active', 'installment', 'pending', 'retired'}


def serialize_equipment(item):
    return {
        'id': item.id,
        'isp_id': item.isp_id,
        'name': item.name,
        'equipment_type': item.equipment_type,
        'serial_number': item.serial_number,
        'vendor': item.vendor,
        'price': item.price or 0,
        'paid_amount': item.paid_amount or 0,
        'outstanding': item.outstanding,
        'status': item.status,
        'location': item.location,
        'purchase_date': item.purchase_date.isoformat() if item.purchase_date else None,
        'warranty_until': item.warranty_until.isoformat() if item.warranty_until else None,
        'notes': item.notes,
        'device_id': item.device_id,
        'device_name': item.device.device_name if item.device else None,
        'created_at': item.created_at.isoformat() if item.created_at else None,
    }


def _parse_date(value):
    if not value:
        return None
    try:
        return datetime.strptime(value[:10], '%Y-%m-%d').date()
    except (TypeError, ValueError):
        return None


def _scoped_query(current_user):
    query = Equipment.query
    if current_user.role != 'admin':
        if not current_user.isp_id:
            return None
        query = query.filter_by(isp_id=current_user.isp_id)
    return query


@equipment_bp.route('', methods=['GET'])
@equipment_bp.route('/', methods=['GET'])
@jwt_required()
def list_equipment():
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'User not found'}), 404
    query = _scoped_query(current_user)
    if query is None:
        return jsonify({'error': 'User not associated with any ISP'}), 403

    type_filter = request.args.get('type')
    status_filter = request.args.get('status')
    search = request.args.get('search')
    if type_filter and type_filter != 'all':
        query = query.filter_by(equipment_type=type_filter)
    if status_filter and status_filter != 'all':
        query = query.filter_by(status=status_filter)
    if search:
        like = f'%{search}%'
        query = query.filter(db.or_(Equipment.name.ilike(like), Equipment.serial_number.ilike(like)))

    items = query.order_by(Equipment.created_at.desc()).all()
    return jsonify({'equipment': [serialize_equipment(i) for i in items]}), 200


@equipment_bp.route('/stats', methods=['GET'])
@jwt_required()
def equipment_stats():
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'User not found'}), 404
    query = _scoped_query(current_user)
    if query is None:
        return jsonify({'error': 'User not associated with any ISP'}), 403

    items = query.all()
    asset_value = sum((i.price or 0) for i in items)
    outstanding = sum(i.outstanding for i in items)
    return jsonify({
        'total': len(items),
        'active': sum(1 for i in items if i.status == 'active'),
        'asset_value': asset_value,
        'outstanding': outstanding,
    }), 200


@equipment_bp.route('', methods=['POST'])
@equipment_bp.route('/', methods=['POST'])
@jwt_required()
def create_equipment():
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'User not found'}), 404
    data = request.get_json(silent=True) or {}
    if not data.get('name'):
        return jsonify({'error': 'name is required'}), 400

    if current_user.role == 'admin':
        isp_id = data.get('isp_id')
        if not isp_id:
            default_isp = ISP.query.filter_by(is_active=True).first()
            if not default_isp:
                return jsonify({'error': 'No active ISP found'}), 400
            isp_id = default_isp.id
    else:
        if not current_user.isp_id:
            return jsonify({'error': 'User not associated with any ISP'}), 403
        isp_id = current_user.isp_id

    price = float(data.get('price') or 0)
    paid = float(data.get('paid_amount') or 0)
    status = (data.get('status') or '').lower()
    if status not in VALID_STATUSES:
        # Derive a sensible default from the payment state.
        if paid <= 0:
            status = 'pending'
        elif paid >= price > 0:
            status = 'active'
        else:
            status = 'installment'

    device_id = data.get('device_id')
    if device_id:
        dev = MikrotikDevice.query.get(device_id)
        if not dev or (current_user.role != 'admin' and dev.isp_id != current_user.isp_id):
            device_id = None

    item = Equipment(
        isp_id=isp_id,
        name=data['name'].strip(),
        equipment_type=data.get('equipment_type') or data.get('type') or 'Router',
        serial_number=(data.get('serial_number') or '').strip() or None,
        vendor=(data.get('vendor') or '').strip() or None,
        price=price,
        paid_amount=paid,
        status=status,
        location=(data.get('location') or '').strip() or None,
        purchase_date=_parse_date(data.get('purchase_date')),
        warranty_until=_parse_date(data.get('warranty_until')),
        notes=(data.get('notes') or '').strip() or None,
        device_id=device_id,
    )
    db.session.add(item)
    db.session.commit()
    return jsonify({'message': 'Equipment created', 'equipment': serialize_equipment(item)}), 201


def _get_owned(item_id, current_user):
    item = Equipment.query.get_or_404(item_id)
    if current_user.role != 'admin' and item.isp_id != current_user.isp_id:
        return None
    return item


@equipment_bp.route('/<int:item_id>', methods=['GET'])
@jwt_required()
def get_equipment(item_id):
    current_user = get_current_user()
    item = _get_owned(item_id, current_user)
    if item is None:
        return jsonify({'error': 'Access denied'}), 403
    return jsonify(serialize_equipment(item)), 200


@equipment_bp.route('/<int:item_id>', methods=['PUT'])
@jwt_required()
def update_equipment(item_id):
    current_user = get_current_user()
    item = _get_owned(item_id, current_user)
    if item is None:
        return jsonify({'error': 'Access denied'}), 403
    data = request.get_json(silent=True) or {}

    for field in ('name', 'serial_number', 'vendor', 'location', 'notes'):
        if field in data:
            setattr(item, field, (data.get(field) or '').strip() or None)
    if 'name' in data and not item.name:
        return jsonify({'error': 'name cannot be empty'}), 400
    if 'equipment_type' in data or 'type' in data:
        item.equipment_type = data.get('equipment_type') or data.get('type') or item.equipment_type
    if 'price' in data:
        item.price = float(data.get('price') or 0)
    if 'paid_amount' in data:
        item.paid_amount = float(data.get('paid_amount') or 0)
    if 'status' in data and (data.get('status') or '').lower() in VALID_STATUSES:
        item.status = data['status'].lower()
    if 'purchase_date' in data:
        item.purchase_date = _parse_date(data.get('purchase_date'))
    if 'warranty_until' in data:
        item.warranty_until = _parse_date(data.get('warranty_until'))
    if 'device_id' in data:
        device_id = data.get('device_id')
        if device_id:
            dev = MikrotikDevice.query.get(device_id)
            item.device_id = dev.id if dev and (current_user.role == 'admin' or dev.isp_id == current_user.isp_id) else None
        else:
            item.device_id = None

    db.session.commit()
    return jsonify({'message': 'Equipment updated', 'equipment': serialize_equipment(item)}), 200


@equipment_bp.route('/<int:item_id>', methods=['DELETE'])
@jwt_required()
def delete_equipment(item_id):
    current_user = get_current_user()
    item = _get_owned(item_id, current_user)
    if item is None:
        return jsonify({'error': 'Access denied'}), 403
    db.session.delete(item)
    db.session.commit()
    return jsonify({'message': 'Equipment deleted'}), 200
