"""WireGuard VPN API — ISP-scoped server and peer management."""
import io

from flask import Blueprint, jsonify, request, send_file
from flask_jwt_extended import jwt_required

from auth_utils import get_current_user
from extensions import db
from models import Customer, ISP, ServicePlan, WireGuardPeer, WireGuardServer
from services.wireguard_accounting import collect_wireguard_stats, server_peer_summary
from services.mikrotik_wireguard import push_peer_to_mikrotik, sync_server_peers_to_mikrotik
from services.wireguard_provisioning import (
    build_client_config,
    build_mikrotik_peer_script,
    build_mikrotik_server_bootstrap,
    build_server_wg_conf,
    create_wireguard_server,
    deprovision_customer_wireguard,
    provision_customer_wireguard,
    serialize_peer,
    sync_server_config_files,
)

wireguard_bp = Blueprint('wireguard', __name__, url_prefix='/api/wireguard')


def _isp_context():
    user = get_current_user()
    if not user:
        return None, None, (jsonify({'ok': False, 'message': 'User not found'}), 404)

    if user.role == 'admin':
        return user, None, None

    if not user.isp_id:
        return user, None, (jsonify({'ok': False, 'message': 'User not associated with an ISP'}), 403)

    isp = ISP.query.get(user.isp_id)
    if not isp:
        return user, None, (jsonify({'ok': False, 'message': 'ISP not found'}), 404)

    return user, isp, None


def _check_server_access(server, isp):
    if isp and server.isp_id != isp.id:
        return jsonify({'ok': False, 'message': 'Access denied'}), 403
    return None


def _check_customer_access(customer, isp):
    if isp and customer.isp_id != isp.id:
        return jsonify({'ok': False, 'message': 'Access denied'}), 403
    return None


def _serialize_server(server, include_summary=False):
    data = {
        'id': server.id,
        'isp_id': server.isp_id,
        'name': server.name,
        'endpoint': server.endpoint,
        'port': server.port,
        'subnet': server.subnet,
        'server_address': server.server_address,
        'public_key': server.public_key,
        'dns_servers': server.dns_servers,
        'mtu': server.mtu,
        'deployment_mode': server.deployment_mode,
        'mikrotik_device_id': server.mikrotik_device_id,
        'is_active': server.is_active,
        'created_at': server.created_at.isoformat() if server.created_at else None,
    }
    if include_summary:
        data['stats'] = server_peer_summary(server.id)
    return data


@wireguard_bp.route('/servers', methods=['GET'])
@jwt_required()
def list_servers():
    user, isp, err = _isp_context()
    if err:
        return err

    query = WireGuardServer.query
    if isp:
        query = query.filter_by(isp_id=isp.id)

    servers = query.order_by(WireGuardServer.id.desc()).all()
    return jsonify({
        'ok': True,
        'data': [_serialize_server(s, include_summary=True) for s in servers],
    })


@wireguard_bp.route('/servers', methods=['POST'])
@jwt_required()
def create_server():
    user, isp, err = _isp_context()
    if err:
        return err

    data = request.get_json() or {}
    required = ['name', 'endpoint', 'subnet']
    for field in required:
        if not data.get(field):
            return jsonify({'ok': False, 'message': f'Missing required field: {field}'}), 400

    target_isp_id = data.get('isp_id') if user.role == 'admin' else (isp.id if isp else None)
    if not target_isp_id:
        return jsonify({'ok': False, 'message': 'isp_id required'}), 400

    target_isp = ISP.query.get(target_isp_id)
    if not target_isp:
        return jsonify({'ok': False, 'message': 'ISP not found'}), 404

    try:
        server = create_wireguard_server(target_isp, data)
        db.session.commit()
        return jsonify({
            'ok': True,
            'message': 'WireGuard server created',
            'data': _serialize_server(server),
        }), 201
    except Exception as exc:
        db.session.rollback()
        return jsonify({'ok': False, 'message': str(exc)}), 500


@wireguard_bp.route('/servers/<int:server_id>', methods=['GET'])
@jwt_required()
def get_server(server_id):
    user, isp, err = _isp_context()
    if err:
        return err

    server = WireGuardServer.query.get_or_404(server_id)
    denied = _check_server_access(server, isp)
    if denied:
        return denied

    return jsonify({'ok': True, 'data': _serialize_server(server, include_summary=True)})


@wireguard_bp.route('/servers/<int:server_id>/peers', methods=['GET'])
@jwt_required()
def list_server_peers(server_id):
    user, isp, err = _isp_context()
    if err:
        return err

    server = WireGuardServer.query.get_or_404(server_id)
    denied = _check_server_access(server, isp)
    if denied:
        return denied

    peers = WireGuardPeer.query.filter_by(server_id=server.id).order_by(WireGuardPeer.id.desc()).all()
    return jsonify({
        'ok': True,
        'data': [
            {
                **serialize_peer(p),
                'customer_name': p.customer.full_name if p.customer else None,
                'customer_email': p.customer.email if p.customer else None,
            }
            for p in peers
        ],
    })


@wireguard_bp.route('/servers/<int:server_id>/config', methods=['GET'])
@jwt_required()
def download_server_config(server_id):
    user, isp, err = _isp_context()
    if err:
        return err

    server = WireGuardServer.query.get_or_404(server_id)
    denied = _check_server_access(server, isp)
    if denied:
        return denied

    sync_server_config_files(server)
    content = build_server_wg_conf(server)
    return send_file(
        io.BytesIO(content.encode('utf-8')),
        mimetype='text/plain',
        as_attachment=True,
        download_name=f'wg-server-{server.id}.conf',
    )


@wireguard_bp.route('/servers/<int:server_id>/mikrotik-script', methods=['GET'])
@jwt_required()
def download_mikrotik_script(server_id):
    user, isp, err = _isp_context()
    if err:
        return err

    server = WireGuardServer.query.get_or_404(server_id)
    denied = _check_server_access(server, isp)
    if denied:
        return denied

    if server.deployment_mode == 'mikrotik':
        content = build_mikrotik_server_bootstrap(server)
        for peer in WireGuardPeer.query.filter_by(server_id=server.id, is_active=True).all():
            content += '\n' + build_mikrotik_peer_script(peer, server)
    else:
        content = '# MikroTik as client to Linux WireGuard server\n'
        content += f'# Route customer traffic to {server.endpoint}:{server.port}\n'

    return send_file(
        io.BytesIO(content.encode('utf-8')),
        mimetype='text/plain',
        as_attachment=True,
        download_name=f'wireguard-mikrotik-{server.id}.rsc',
    )


@wireguard_bp.route('/customers/<int:customer_id>/provision', methods=['POST'])
@jwt_required()
def provision_customer(customer_id):
    user, isp, err = _isp_context()
    if err:
        return err

    customer = Customer.query.get_or_404(customer_id)
    denied = _check_customer_access(customer, isp)
    if denied:
        return denied

    plan = customer.service_plan
    if not plan and customer.service_plan_id:
        plan = ServicePlan.query.get(customer.service_plan_id)

    if not plan or plan.plan_type != 'wireguard':
        return jsonify({'ok': False, 'message': 'Customer plan is not WireGuard type'}), 400

    customer_isp = ISP.query.get(customer.isp_id)
    if not customer_isp:
        return jsonify({'ok': False, 'message': 'Customer ISP not found'}), 404

    data = request.get_json() or {}
    server = None
    if data.get('server_id'):
        server = WireGuardServer.query.get(data['server_id'])

    try:
        peer = provision_customer_wireguard(customer, plan, customer_isp, server=server)
        db.session.commit()
        return jsonify({
            'ok': True,
            'message': 'WireGuard peer provisioned',
            'data': serialize_peer(peer, include_config=True, plan=plan),
        }), 201
    except Exception as exc:
        db.session.rollback()
        return jsonify({'ok': False, 'message': str(exc)}), 500


@wireguard_bp.route('/customers/<int:customer_id>/config', methods=['GET'])
@jwt_required()
def download_customer_config(customer_id):
    user, isp, err = _isp_context()
    if err:
        return err

    customer = Customer.query.get_or_404(customer_id)
    denied = _check_customer_access(customer, isp)
    if denied:
        return denied

    peer = WireGuardPeer.query.filter_by(customer_id=customer.id, is_active=True).first()
    if not peer:
        return jsonify({'ok': False, 'message': 'No active WireGuard peer for customer'}), 404

    plan = customer.service_plan
    content = build_client_config(peer, peer.server, plan)
    filename = f'infora-wg-{customer.email.split("@")[0]}.conf'
    return send_file(
        io.BytesIO(content.encode('utf-8')),
        mimetype='text/plain',
        as_attachment=True,
        download_name=filename,
    )


@wireguard_bp.route('/customers/<int:customer_id>/qrcode', methods=['GET'])
@jwt_required()
def customer_qrcode(customer_id):
    user, isp, err = _isp_context()
    if err:
        return err

    customer = Customer.query.get_or_404(customer_id)
    denied = _check_customer_access(customer, isp)
    if denied:
        return denied

    peer = WireGuardPeer.query.filter_by(customer_id=customer.id, is_active=True).first()
    if not peer:
        return jsonify({'ok': False, 'message': 'No active WireGuard peer'}), 404

    try:
        import qrcode
    except ImportError:
        return jsonify({'ok': False, 'message': 'qrcode package not installed'}), 503

    plan = customer.service_plan
    config_text = build_client_config(peer, peer.server, plan)
    img = qrcode.make(config_text)
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    return send_file(buf, mimetype='image/png', download_name=f'wg-qr-{customer.id}.png')


@wireguard_bp.route('/customers/<int:customer_id>/peer', methods=['GET'])
@jwt_required()
def get_customer_peer(customer_id):
    user, isp, err = _isp_context()
    if err:
        return err

    customer = Customer.query.get_or_404(customer_id)
    denied = _check_customer_access(customer, isp)
    if denied:
        return denied

    peer = WireGuardPeer.query.filter_by(customer_id=customer.id).first()
    if not peer:
        return jsonify({'ok': True, 'data': None})

    return jsonify({'ok': True, 'data': serialize_peer(peer, plan=customer.service_plan)})


@wireguard_bp.route('/peers/<int:peer_id>', methods=['DELETE'])
@jwt_required()
def delete_peer(peer_id):
    user, isp, err = _isp_context()
    if err:
        return err

    peer = WireGuardPeer.query.get_or_404(peer_id)
    if isp and peer.isp_id != isp.id:
        return jsonify({'ok': False, 'message': 'Access denied'}), 403

    customer = Customer.query.get(peer.customer_id)
    if customer:
        deprovision_customer_wireguard(customer)
    else:
        server = WireGuardServer.query.get(peer.server_id)
        db.session.delete(peer)
        if server:
            sync_server_config_files(server)

    db.session.commit()
    return jsonify({'ok': True, 'message': 'WireGuard peer deprovisioned'})


@wireguard_bp.route('/sync-stats', methods=['POST'])
@jwt_required()
def sync_stats():
    user, isp, err = _isp_context()
    if err:
        return err

    if user.role != 'admin' and not isp:
        return jsonify({'ok': False, 'message': 'Forbidden'}), 403

    result = collect_wireguard_stats()
    return jsonify({'ok': True, 'data': result})


@wireguard_bp.route('/peers/<int:peer_id>/sync-mikrotik', methods=['POST'])
@jwt_required()
def sync_peer_mikrotik(peer_id):
    """Manually re-push a peer to MikroTik (peer + bandwidth queue)."""
    user, isp, err = _isp_context()
    if err:
        return err

    peer = WireGuardPeer.query.get_or_404(peer_id)
    if isp and peer.isp_id != isp.id:
        return jsonify({'ok': False, 'message': 'Access denied'}), 403

    customer = Customer.query.get(peer.customer_id)
    plan = customer.service_plan if customer else None
    result = push_peer_to_mikrotik(peer, plan=plan, customer=customer)
    db.session.commit()

    return jsonify({
        'ok': result.get('ok', False),
        'data': result,
        'peer': serialize_peer(peer, plan=plan),
    })


@wireguard_bp.route('/servers/<int:server_id>/sync-mikrotik', methods=['POST'])
@jwt_required()
def sync_server_mikrotik(server_id):
    """Push all active peers on a server to MikroTik."""
    user, isp, err = _isp_context()
    if err:
        return err

    server = WireGuardServer.query.get_or_404(server_id)
    denied = _check_server_access(server, isp)
    if denied:
        return denied

    result = sync_server_peers_to_mikrotik(server_id)
    db.session.commit()
    return jsonify({'ok': result.get('ok', False), 'data': result})
