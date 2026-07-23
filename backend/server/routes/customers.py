from flask import Blueprint, request, jsonify, Response
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import or_
from extensions import db
from auth_utils import get_current_user
from models import User, Customer, CustomerStatus, ServicePlan, ISP, KycStatus, RadAcct, MikrotikDevice
from datetime import datetime
from services.radius_provisioning import (
    provision_customer_radius,
    deprovision_customer_radius,
    suspend_customer_access,
    activate_customer_after_payment,
    set_customer_radius_password,
    get_customer_radius_password,
    radius_username,
    sync_customer_radius_status,
    ensure_account_number,
    find_customer_by_login,
)
import secrets

customers_bp = Blueprint('customers', __name__, url_prefix='/api/customers')


def _resolve_isp_for_user():
    """Return ISP for the current JWT user (None for admin without ISP)."""
    user = get_current_user()
    if not user:
        return None
    if user.isp_id:
        return ISP.query.get(user.isp_id)
    return ISP.query.filter_by(is_active=True).first()


def _resolve_plan_for_customer(data, isp):
    """Resolve service plan from service_plan_id or package name."""
    if data.get('service_plan_id'):
        return ServicePlan.query.get(data['service_plan_id'])
    package = data.get('package')
    if package and isp:
        return ServicePlan.query.filter_by(name=package, isp_id=isp.id).first()
    if isp:
        return ServicePlan.query.filter_by(isp_id=isp.id, is_active=True).first()
    return None


def _serialize_wireguard_peer(customer):
    from services.wireguard_provisioning import serialize_peer
    peer = getattr(customer, 'wireguard_peer', None)
    if not peer or not peer.is_active:
        return None
    return serialize_peer(peer, plan=customer.service_plan)


def serialize_customer(customer):
    """Serialize customer object to dictionary"""
    try:
        return {
            'id': customer.id,
            'name': customer.full_name,
            'email': customer.email,
            'phone': customer.phone,
            'address': customer.address,
            'status': customer.status.value if customer.status else 'active',
            'join_date': customer.join_date.isoformat() if customer.join_date else None,
            'balance': float(customer.balance) if customer.balance else 0.0,
            'package': customer.package,
            'usage_percentage': customer.usage_percentage,
            'device_count': customer.device_count,
            'last_payment_date': customer.last_payment_date.isoformat() if customer.last_payment_date else None,
            'created_at': customer.created_at.isoformat() if customer.created_at else None,
            'updated_at': customer.updated_at.isoformat() if customer.updated_at else None,
            'service_plan_id': customer.service_plan_id,
            'id_number': customer.id_number,
            'kyc_status': customer.kyc_status.value if getattr(customer, 'kyc_status', None) else 'pending',
            'kyc_verified_at': customer.kyc_verified_at.isoformat() if getattr(customer, 'kyc_verified_at', None) else None,
            'kyc_notes': customer.kyc_notes,
            'subscription_start': customer.subscription_start.isoformat() if customer.subscription_start else None,
            'subscription_end': customer.subscription_end.isoformat() if customer.subscription_end else None,
            'connection_type': customer.connection_type or 'pppoe',
            'radius_login': customer.radius_login,
            'account_number': customer.account_number,
            'radius_username': radius_username(customer) or None,
            'wireguard_peer': _serialize_wireguard_peer(customer),
            'service_plan': {
                'id': customer.service_plan.id,
                'name': customer.service_plan.name,
                'speed': customer.service_plan.speed,
                'price': float(customer.service_plan.price) if customer.service_plan.price else 0.0
            } if hasattr(customer, 'service_plan') and customer.service_plan else None
        }
    except Exception as e:
        # Return basic customer data without service plan
        return {
            'id': customer.id,
            'name': customer.full_name,
            'email': customer.email,
            'radius_login': getattr(customer, 'radius_login', None),
            'account_number': getattr(customer, 'account_number', None),
            'phone': customer.phone,
            'address': customer.address,
            'status': customer.status.value if customer.status else 'active',
            'join_date': customer.join_date.isoformat() if customer.join_date else None,
            'balance': float(customer.balance) if customer.balance else 0.0,
            'package': customer.package,
            'usage_percentage': customer.usage_percentage,
            'device_count': customer.device_count,
            'last_payment_date': customer.last_payment_date.isoformat() if customer.last_payment_date else None,
            'created_at': customer.created_at.isoformat() if customer.created_at else None,
            'updated_at': customer.updated_at.isoformat() if customer.updated_at else None,
            'service_plan_id': customer.service_plan_id,
            'id_number': getattr(customer, 'id_number', None),
            'kyc_status': customer.kyc_status.value if getattr(customer, 'kyc_status', None) else 'pending',
            'kyc_verified_at': customer.kyc_verified_at.isoformat() if getattr(customer, 'kyc_verified_at', None) else None,
            'kyc_notes': getattr(customer, 'kyc_notes', None),
            'service_plan': None
        }

@customers_bp.route('/', methods=['GET'])
@customers_bp.route('', methods=['GET'])
@jwt_required()
def get_customers():
    """Get all customers with pagination and filtering"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        search = request.args.get('search')
        status = request.args.get('status')
        connection_type = request.args.get('connection_type')
        sort_by = request.args.get('sort_by', 'created_at')
        sort_order = request.args.get('sort_order', 'desc')
        
        
        query = Customer.query

        if connection_type:
            allowed = {'hotspot', 'pppoe', 'wireguard'}
            if connection_type not in allowed:
                return jsonify({'error': 'Invalid connection_type'}), 400
            query = query.filter_by(connection_type=connection_type)
        
        # Search functionality
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    Customer.full_name.ilike(search_term),
                    Customer.email.ilike(search_term),
                    Customer.phone.ilike(search_term)
                )
            )
        
        # Status filter
        if status:
            try:
                status_enum = CustomerStatus(status)
                query = query.filter_by(status=status_enum)
            except ValueError:
                return jsonify({'error': 'Invalid status value'}), 400
        
        # Sorting
        if hasattr(Customer, sort_by):
            sort_column = getattr(Customer, sort_by)
            if sort_order == 'desc':
                query = query.order_by(sort_column.desc())
            else:
                query = query.order_by(sort_column.asc())
        else:
            query = query.order_by(Customer.created_at.desc())
        
        customers = query.paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        
        response_data = {
            'customers': [serialize_customer(customer) for customer in customers.items],
            'total': customers.total,
            'pages': customers.pages,
            'current_page': page,
            'per_page': per_page
        }
        
        return jsonify(response_data), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get customers: {str(e)}'}), 500


def _resolve_session_customer(record, customer_by_id, customer_by_email):
    if record.customer_id and record.customer_id in customer_by_id:
        return customer_by_id[record.customer_id]
    username = (record.username or '').strip().lower()
    return customer_by_email.get(username)


def _infer_connection_type(record, customer):
    if customer and customer.connection_type:
        return customer.connection_type
    protocol = (record.framedprotocol or '').lower()
    if 'ppp' in protocol:
        return 'pppoe'
    service = (record.servicetype or '').lower()
    if service in ('framed-user', 'login-user'):
        return 'hotspot'
    return 'pppoe'


def _serialize_active_session(record, customer=None, device=None):
    now = datetime.utcnow()
    start = record.acctstarttime
    duration_sec = record.acctsessiontime or 0
    if start and not record.acctstoptime:
        duration_sec = max(duration_sec, int((now - start).total_seconds()))

    conn_type = _infer_connection_type(record, customer)
    router_name = device.device_name if device else record.nasipaddress

    return {
        'id': record.radacctid,
        'session_id': record.acctsessionid,
        'username': record.username,
        'customer_id': customer.id if customer else record.customer_id,
        'customer_name': customer.full_name if customer else None,
        'connection_type': conn_type,
        'ip_address': record.framedipaddress,
        'mac_address': record.callingstationid,
        'router_id': device.id if device else record.mikrotik_device_id,
        'router_name': router_name,
        'nas_ip': record.nasipaddress,
        'session_start': start.isoformat() if start else None,
        'duration_seconds': duration_sec,
        'bytes_in': int(record.acctinputoctets or 0),
        'bytes_out': int(record.acctoutputoctets or 0),
        'plan_name': customer.service_plan.name if customer and customer.service_plan else record.groupname,
    }


@customers_bp.route('/sessions/active', methods=['GET'])
@jwt_required()
def get_active_online_sessions():
    """Live sessions from FreeRADIUS radacct (acctstoptime IS NULL)."""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'error': 'User not found'}), 404

        connection_type = (request.args.get('connection_type') or 'all').strip().lower()
        search = (request.args.get('search') or '').strip()
        router_id = request.args.get('router_id', type=int)

        if connection_type not in ('all', 'pppoe', 'hotspot'):
            return jsonify({'error': 'Invalid connection_type'}), 400

        query = RadAcct.query.filter(RadAcct.acctstoptime.is_(None))

        if user.role != 'admin' and user.isp_id:
            query = query.filter(RadAcct.isp_id == user.isp_id)

        if router_id:
            device = MikrotikDevice.query.get(router_id)
            if device:
                query = query.filter(
                    or_(
                        RadAcct.mikrotik_device_id == router_id,
                        RadAcct.nasipaddress == device.device_ip,
                    )
                )

        if search:
            term = f'%{search}%'
            query = query.filter(
                or_(
                    RadAcct.username.ilike(term),
                    RadAcct.framedipaddress.ilike(term),
                    RadAcct.callingstationid.ilike(term),
                    RadAcct.acctsessionid.ilike(term),
                )
            )

        records = query.order_by(RadAcct.acctstarttime.desc()).limit(500).all()

        customer_ids = {r.customer_id for r in records if r.customer_id}
        usernames = {(r.username or '').strip().lower() for r in records if r.username}
        customers_by_id = {}
        # Keyed by the effective RADIUS username (radius_login, else email) so it
        # matches the radacct username regardless of which handle the client uses.
        customers_by_email = {}
        if customer_ids or usernames:
            username_match = or_(
                db.func.lower(Customer.email).in_(list(usernames)),
                db.func.lower(Customer.radius_login).in_(list(usernames)),
            )
            customer_query = Customer.query
            if customer_ids and usernames:
                customer_query = customer_query.filter(
                    or_(Customer.id.in_(customer_ids), username_match)
                )
            elif customer_ids:
                customer_query = customer_query.filter(Customer.id.in_(customer_ids))
            else:
                customer_query = customer_query.filter(username_match)
            for customer in customer_query.all():
                customers_by_id[customer.id] = customer
                key = radius_username(customer)
                if key:
                    customers_by_email[key] = customer

        device_ids = {r.mikrotik_device_id for r in records if r.mikrotik_device_id}
        nas_ips = {r.nasipaddress for r in records if r.nasipaddress}
        devices_by_id = {}
        devices_by_ip = {}
        device_filters = []
        if device_ids:
            device_filters.append(MikrotikDevice.id.in_(device_ids))
        if nas_ips:
            device_filters.append(MikrotikDevice.device_ip.in_(list(nas_ips)))
        if device_filters:
            device_query = MikrotikDevice.query.filter(or_(*device_filters))
            if user.role != 'admin' and user.isp_id:
                device_query = device_query.filter(MikrotikDevice.isp_id == user.isp_id)
            for device in device_query.all():
                devices_by_id[device.id] = device
                devices_by_ip[device.device_ip] = device

        sessions = []
        counts = {'all': 0, 'pppoe': 0, 'hotspot': 0}
        for record in records:
            customer = _resolve_session_customer(record, customers_by_id, customers_by_email)
            device = None
            if record.mikrotik_device_id:
                device = devices_by_id.get(record.mikrotik_device_id)
            if not device and record.nasipaddress:
                device = devices_by_ip.get(record.nasipaddress)

            payload = _serialize_active_session(record, customer, device)
            counts['all'] += 1
            if payload['connection_type'] == 'hotspot':
                counts['hotspot'] += 1
            else:
                counts['pppoe'] += 1

            if connection_type != 'all' and payload['connection_type'] != connection_type:
                continue
            sessions.append(payload)

        router_query = MikrotikDevice.query.filter_by(is_active=True)
        if user.role != 'admin' and user.isp_id:
            router_query = router_query.filter_by(isp_id=user.isp_id)
        routers = [
            {'id': d.id, 'name': d.device_name, 'ip': d.device_ip}
            for d in router_query.order_by(MikrotikDevice.device_name).all()
        ]

        return jsonify({
            'ok': True,
            'data': {
                'sessions': sessions,
                'counts': counts,
                'routers': routers,
            },
        }), 200

    except Exception as e:
        return jsonify({'error': f'Failed to load active sessions: {str(e)}'}), 500


@customers_bp.route('/<int:customer_id>', methods=['GET'])
@jwt_required()
def get_customer(customer_id):
    """Get specific customer by ID"""
    try:
        customer = Customer.query.get_or_404(customer_id)
        return jsonify(serialize_customer(customer)), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get customer: {str(e)}'}), 500

@customers_bp.route('/', methods=['POST'])
@customers_bp.route('', methods=['POST'])
@jwt_required()
def create_customer():
    """Create a new customer"""
    try:
        data = request.get_json()

        # Validate required fields. Email is optional now that the connection
        # login is decoupled from it; name + phone remain required.
        required_fields = ['name', 'phone']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400

        isp = _resolve_isp_for_user()
        if not isp:
            return jsonify({'error': 'No ISP context — assign user to an ISP or create an ISP first'}), 400

        email = (data.get('email') or '').strip().lower() or None
        radius_login = (data.get('radius_login') or '').strip().lower() or None

        # A client needs at least one login handle.
        if not email and not radius_login:
            return jsonify({'error': 'Provide an email or a connection username (radius_login)'}), 400

        # Uniqueness: email is globally unique when present; radius_login is
        # unique per ISP.
        if email and Customer.query.filter_by(email=email).first():
            return jsonify({'error': 'Email already registered'}), 409
        if radius_login and find_customer_by_login(radius_login, isp_id=isp.id):
            return jsonify({'error': 'Connection username already in use'}), 409

        # Create customer
        status = CustomerStatus(data.get('status', 'active')) if data.get('status') else CustomerStatus.ACTIVE

        plan = _resolve_plan_for_customer(data, isp)
        package_name = plan.name if plan else data.get('package', 'Basic WiFi')
        requested_type = (data.get('connection_type') or '').strip().lower() or None

        if requested_type and requested_type not in ('hotspot', 'pppoe', 'wireguard'):
            return jsonify({'error': 'Invalid connection_type'}), 400
        if plan and requested_type and plan.plan_type != requested_type:
            return jsonify({
                'error': f'Selected plan is for {plan.plan_type} clients, not {requested_type}',
            }), 400
        if requested_type == 'hotspot' and status == CustomerStatus.ACTIVE:
            return jsonify({
                'error': 'Hotspot clients are created via the captive portal after payment',
            }), 400

        connection_type = requested_type or (plan.plan_type if plan else 'pppoe')

        customer = Customer(
            full_name=data['name'],
            email=email,
            radius_login=radius_login,
            phone=data['phone'],
            address=data.get('address'),
            status=status,
            balance=data.get('balance', 0.00),
            package=package_name,
            usage_percentage=data.get('usage_percentage', 0),
            device_count=data.get('device_count', 0),
            isp_id=isp.id,
            service_plan_id=plan.id if plan else None,
            connection_type=connection_type,
        )

        if plan and status == CustomerStatus.ACTIVE:
            from services.portal_service import plan_subscription_end
            customer.subscription_start = datetime.utcnow()
            customer.subscription_end = plan_subscription_end(plan)

        db.session.add(customer)
        db.session.flush()

        # Stable, customer-facing account number (also the M-Pesa reference).
        ensure_account_number(customer, isp, preferred=data.get('account_number'))

        generated_password = None
        radius_provisioned = False
        wireguard_provisioned = False
        radius_provision_reason = None

        if status == CustomerStatus.ACTIVE and plan:
            if plan.plan_type == 'wireguard':
                from services.wireguard_provisioning import provision_customer_wireguard
                provision_customer_wireguard(customer, plan, isp)
                wireguard_provisioned = True
            else:
                password = data.get('password') or secrets.token_urlsafe(8)
                set_customer_radius_password(customer, password)
                generated_password = password
                provision_customer_radius(customer, plan, isp, password=generated_password)
                radius_provisioned = True
        elif status == CustomerStatus.PENDING:
            radius_provision_reason = 'Customer is pending — activate or connect to provision RADIUS'
        elif not plan:
            radius_provision_reason = 'No service plan assigned — RADIUS not provisioned'
        elif status != CustomerStatus.ACTIVE:
            radius_provision_reason = f'Customer status is {status.value} — RADIUS not provisioned on create'

        db.session.commit()

        response = {
            'message': 'Customer created successfully',
            'customer': serialize_customer(customer),
            'radius_provisioned': radius_provisioned,
            'wireguard_provisioned': wireguard_provisioned,
            'radius_provision_reason': radius_provision_reason,
        }
        if generated_password:
            response['radius_password'] = generated_password

        return jsonify(response), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to create customer: {str(e)}'}), 500

@customers_bp.route('/import/template', methods=['GET'])
@jwt_required()
def download_import_template():
    """Download the client-import CSV template (header + sample rows)."""
    from services.customer_import import build_template_csv
    return Response(
        build_template_csv(),
        mimetype='text/csv',
        headers={'Content-Disposition': 'attachment; filename=infora_client_import_template.csv'},
    )


@customers_bp.route('/import', methods=['POST'])
@jwt_required()
def import_customers():
    """Bulk-import subscribers from another billing system.

    Accepts either a multipart CSV upload (field ``file``) or a JSON body
    ``{"rows": [...], "dry_run": true}`` (``rows`` may instead be raw CSV text
    under ``csv``). ``dry_run`` defaults to true — it validates and previews
    without writing; pass ``dry_run=false`` to commit.
    """
    from services.customer_import import parse_csv, process_import

    isp = _resolve_isp_for_user()
    if not isp:
        return jsonify({'error': 'No ISP context — assign user to an ISP or create an ISP first'}), 400

    plan_map = None
    create_plans = None
    auto_create_plans = True
    if 'file' in request.files:
        try:
            rows = parse_csv(request.files['file'].read())
        except Exception as exc:
            return jsonify({'error': f'Could not parse CSV: {exc}'}), 400
        dry_run = (request.form.get('dry_run', 'true').strip().lower() != 'false')
        default_status = (request.form.get('default_status') or 'active').strip().lower()
    else:
        data = request.get_json(silent=True) or {}
        rows = data.get('rows')
        if rows is None and data.get('csv'):
            rows = parse_csv(data['csv'])
        dry_run = bool(data.get('dry_run', True))
        default_status = (data.get('default_status') or 'active').strip().lower()
        plan_map = data.get('plan_map') if isinstance(data.get('plan_map'), dict) else None
        create_plans = data.get('create_plans') if isinstance(data.get('create_plans'), list) else None
        if 'auto_create_plans' in data:
            auto_create_plans = bool(data.get('auto_create_plans'))

    if not rows:
        return jsonify({'error': 'No rows to import (empty file or body)'}), 400
    if not isinstance(rows, list):
        return jsonify({'error': 'rows must be a list'}), 400

    try:
        summary = process_import(
            isp, rows, dry_run=dry_run, default_status=default_status,
            plan_map=plan_map, create_plans=create_plans,
            auto_create_plans=auto_create_plans,
        )
    except Exception as exc:
        db.session.rollback()
        return jsonify({'error': f'Import failed: {exc}'}), 500

    return jsonify(summary), 200


@customers_bp.route('/<int:customer_id>', methods=['PUT'])
@jwt_required()
def update_customer(customer_id):
    """Update customer information"""
    try:
        customer = Customer.query.get_or_404(customer_id)
        data = request.get_json()
        old_status = customer.status
        # Capture the login before any change so we can clean up stale RADIUS
        # rows if the username effectively changes.
        old_username = radius_username(customer)

        # Update fields
        if 'name' in data:
            customer.full_name = data['name']
        if 'email' in data:
            new_email = (data['email'] or '').strip().lower() or None
            if new_email:
                existing_customer = Customer.query.filter_by(email=new_email).first()
                if existing_customer and existing_customer.id != customer.id:
                    return jsonify({'error': 'Email already taken'}), 409
            customer.email = new_email
        if 'radius_login' in data:
            new_login = (data['radius_login'] or '').strip().lower() or None
            if new_login:
                clash = find_customer_by_login(new_login, isp_id=customer.isp_id)
                if clash and clash.id != customer.id:
                    return jsonify({'error': 'Connection username already in use'}), 409
            customer.radius_login = new_login
        # Guard the login invariant after applying email/radius_login edits.
        if not customer.email and not customer.radius_login:
            return jsonify({'error': 'Client must keep an email or a connection username'}), 400
        if 'account_number' in data:
            new_acct = (data['account_number'] or '').strip() or None
            if new_acct and new_acct != customer.account_number:
                clash = Customer.query.filter_by(
                    account_number=new_acct, isp_id=customer.isp_id
                ).first()
                if clash and clash.id != customer.id:
                    return jsonify({'error': 'Account number already in use'}), 409
            customer.account_number = new_acct
        if 'phone' in data:
            customer.phone = data['phone']
        if 'address' in data:
            customer.address = data['address']
        if 'status' in data:
            customer.status = CustomerStatus(data['status'])
        if 'balance' in data:
            customer.balance = data['balance']
        if 'usage_percentage' in data:
            customer.usage_percentage = data['usage_percentage']
        if 'device_count' in data:
            customer.device_count = data['device_count']
        if 'service_plan_id' in data:
            customer.service_plan_id = data['service_plan_id']
            plan = ServicePlan.query.get(data['service_plan_id'])
            if plan:
                customer.package = plan.name

        new_username = radius_username(customer)
        login_changed = new_username != old_username

        # If the login changed, the old radcheck/radreply/radusergroup rows are
        # keyed under the old username and must be removed before re-provisioning
        # under the new one.
        if login_changed and customer.isp_id:
            from services.radius_provisioning import delete_radius_rows_for_username
            delete_radius_rows_for_username(old_username, customer.isp_id)

        if customer.status != old_status or 'service_plan_id' in data or login_changed:
            sync_customer_radius_status(customer, old_status=old_status)

        db.session.commit()
        
        return jsonify({
            'message': 'Customer updated successfully',
            'customer': serialize_customer(customer)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update customer: {str(e)}'}), 500

@customers_bp.route('/<int:customer_id>', methods=['DELETE'])
@jwt_required()
def delete_customer(customer_id):
    """Delete customer"""
    try:
        customer = Customer.query.get_or_404(customer_id)

        isp = ISP.query.get(customer.isp_id) if customer.isp_id else None
        if isp:
            deprovision_customer_radius(customer, isp)

        # Delete the customer (cascade will handle related data)
        try:
            db.session.delete(customer)
            db.session.commit()
        except Exception as delete_error:
            db.session.rollback()
            
            # If there are foreign key constraint violations, try to handle them
            if "foreign key constraint" in str(delete_error).lower():
                return jsonify({'error': 'Cannot delete customer due to existing related data. Please remove all related records first.'}), 400
            
            raise delete_error
        
        return jsonify({'message': 'Customer deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        
        # Provide more specific error messages
        if "foreign key constraint" in str(e).lower():
            return jsonify({'error': 'Cannot delete customer due to existing related data. Please remove all related records first.'}), 400
        elif "not found" in str(e).lower():
            return jsonify({'error': 'Customer not found'}), 404
        else:
            return jsonify({'error': f'Failed to delete customer: {str(e)}'}), 500

@customers_bp.route('/<int:customer_id>/status', methods=['PUT'])
@jwt_required()
def update_customer_status(customer_id):
    """Update customer status"""
    try:
        customer = Customer.query.get_or_404(customer_id)
        data = request.get_json()

        new_status = data.get('status')
        if not new_status:
            return jsonify({'error': 'Status is required'}), 400

        old_status = customer.status
        try:
            customer.status = CustomerStatus(new_status)
        except ValueError:
            return jsonify({'error': 'Invalid status'}), 400

        if customer.status != old_status:
            sync_customer_radius_status(customer, old_status=old_status)

        db.session.commit()
        
        return jsonify({
            'message': 'Customer status updated successfully',
            'customer': serialize_customer(customer)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update customer status: {str(e)}'}), 500

@customers_bp.route('/<int:customer_id>/balance', methods=['PUT'])
@jwt_required()
def update_customer_balance(customer_id):
    """Update customer balance"""
    try:
        customer = Customer.query.get_or_404(customer_id)
        data = request.get_json()
        
        new_balance = data.get('balance')
        if new_balance is None:
            return jsonify({'error': 'Balance is required'}), 400
        
        try:
            new_balance = float(new_balance)
        except ValueError:
            return jsonify({'error': 'Invalid balance amount'}), 400
        
        customer.balance = new_balance
        db.session.commit()
        
        return jsonify({
            'message': 'Customer balance updated successfully',
            'customer': serialize_customer(customer)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update customer balance: {str(e)}'}), 500

@customers_bp.route('/<int:customer_id>/usage', methods=['PUT'])
@jwt_required()
def update_customer_usage(customer_id):
    """Update customer usage statistics"""
    try:
        customer = Customer.query.get_or_404(customer_id)
        data = request.get_json()
        
        if 'usage_percentage' in data:
            usage = data['usage_percentage']
            if not isinstance(usage, int) or usage < 0 or usage > 100:
                return jsonify({'error': 'Usage percentage must be between 0 and 100'}), 400
            customer.usage_percentage = usage
        
        if 'device_count' in data:
            device_count = data['device_count']
            if not isinstance(device_count, int) or device_count < 0:
                return jsonify({'error': 'Device count must be a positive integer'}), 400
            customer.device_count = device_count
        
        db.session.commit()
        
        return jsonify({
            'message': 'Customer usage updated successfully',
            'customer': serialize_customer(customer)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update customer usage: {str(e)}'}), 500

@customers_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_customer_stats():
    """Get customer statistics"""
    try:
        total_customers = Customer.query.count()
        active_customers = Customer.query.filter_by(status=CustomerStatus.ACTIVE).count()
        suspended_customers = Customer.query.filter_by(status=CustomerStatus.SUSPENDED).count()
        pending_customers = Customer.query.filter_by(status=CustomerStatus.PENDING).count()
        pppoe_clients = Customer.query.filter_by(connection_type='pppoe').count()
        hotspot_clients = Customer.query.filter_by(connection_type='hotspot').count()
        active_pppoe = Customer.query.filter_by(
            connection_type='pppoe', status=CustomerStatus.ACTIVE
        ).count()
        active_hotspot = Customer.query.filter_by(
            connection_type='hotspot', status=CustomerStatus.ACTIVE
        ).count()
        
        # Average balance
        avg_balance = db.session.query(db.func.avg(Customer.balance)).scalar() or 0
        
        # Total balance across all customers
        total_balance = db.session.query(db.func.sum(Customer.balance)).scalar() or 0
        
        # Customers with outstanding balance
        customers_with_balance = Customer.query.filter(Customer.balance > 0).count()
        
        # Average usage percentage
        avg_usage = db.session.query(db.func.avg(Customer.usage_percentage)).scalar() or 0
        
        # Top customers by balance
        top_customers = Customer.query.order_by(Customer.balance.desc()).limit(5).all()
        
        
        response_data = {
            'total_customers': total_customers,
            'total_clients': total_customers,
            'active_customers': active_customers,
            'suspended_customers': suspended_customers,
            'pending_customers': pending_customers,
            'pppoe_clients': pppoe_clients,
            'hotspot_clients': hotspot_clients,
            'active_pppoe_clients': active_pppoe,
            'active_hotspot_clients': active_hotspot,
            'average_balance': float(avg_balance),
            'total_balance': float(total_balance),
            'customers_with_balance': customers_with_balance,
            'average_usage': float(avg_usage),
            'top_customers_by_balance': [
                {
                    'id': customer.id,
                    'name': customer.full_name,
                    'balance': float(customer.balance)
                }
                for customer in top_customers
            ]
        }
        
        return jsonify(response_data), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get customer stats: {str(e)}'}), 500

@customers_bp.route('/<int:customer_id>/connect', methods=['POST'])
@jwt_required()
def connect_client(customer_id):
    """Connect client to internet — provision RADIUS and set active."""
    try:
        customer = Customer.query.get_or_404(customer_id)
        isp = ISP.query.get(customer.isp_id) if customer.isp_id else _resolve_isp_for_user()
        if not isp:
            return jsonify({'error': 'No ISP context'}), 400
        if customer.connection_type not in ('pppoe', 'hotspot'):
            return jsonify({'error': 'Connect/disconnect applies to PPPoE and hotspot clients only'}), 400
        if customer.status == CustomerStatus.ACTIVE:
            return jsonify({'message': 'Client is already connected', 'customer': serialize_customer(customer)}), 200

        plan = customer.service_plan
        if not plan:
            return jsonify({'error': 'Assign a service plan before connecting'}), 400

        activate_customer_after_payment(customer, isp)
        db.session.commit()
        return jsonify({
            'message': 'Client connected — internet access provisioned',
            'customer': serialize_customer(customer),
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to connect client: {str(e)}'}), 500


@customers_bp.route('/<int:customer_id>/disconnect', methods=['POST'])
@jwt_required()
def disconnect_client(customer_id):
    """Disconnect client from internet — suspend and remove RADIUS access."""
    try:
        customer = Customer.query.get_or_404(customer_id)
        isp = ISP.query.get(customer.isp_id) if customer.isp_id else _resolve_isp_for_user()
        if customer.connection_type not in ('pppoe', 'hotspot'):
            return jsonify({'error': 'Connect/disconnect applies to PPPoE and hotspot clients only'}), 400
        if customer.status == CustomerStatus.SUSPENDED:
            return jsonify({'message': 'Client is already disconnected', 'customer': serialize_customer(customer)}), 200

        suspend_customer_access(customer, isp)
        db.session.commit()
        return jsonify({
            'message': 'Client disconnected — internet access removed',
            'customer': serialize_customer(customer),
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to disconnect client: {str(e)}'}), 500


def _authorize_customer_secret(customer):
    """Guard for endpoints that expose a customer's plaintext RADIUS secret.

    Returns None when allowed, or a (json, status) tuple to return otherwise.
    Tighter than the plain get_customer route: non-admins are limited to their
    own ISP, and only PPPoE/hotspot clients have RADIUS credentials.
    """
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    if user.role != 'admin' and user.isp_id and customer.isp_id != user.isp_id:
        return jsonify({'error': 'Access denied'}), 403
    if customer.connection_type not in ('pppoe', 'hotspot'):
        return jsonify({'error': 'RADIUS credentials apply to PPPoE and hotspot clients only'}), 400
    return None


@customers_bp.route('/<int:customer_id>/radius-credentials', methods=['GET'])
@jwt_required()
def get_customer_radius_credentials(customer_id):
    """Reveal a client's PPPoE/hotspot login (username + stored password)."""
    try:
        customer = Customer.query.get_or_404(customer_id)
        denied = _authorize_customer_secret(customer)
        if denied:
            return denied

        password = get_customer_radius_password(customer)
        return jsonify({
            'ok': True,
            'data': {
                'username': radius_username(customer),
                'password': password,
                'has_password': bool(password),
                'connection_type': customer.connection_type,
            },
        }), 200
    except Exception as e:
        return jsonify({'error': f'Failed to load credentials: {str(e)}'}), 500


@customers_bp.route('/<int:customer_id>/radius-credentials/reset', methods=['POST'])
@jwt_required()
def reset_customer_radius_credentials(customer_id):
    """Set a new PPPoE/hotspot password and re-provision RADIUS.

    Accepts an optional ``password`` in the body, else generates one. For an
    active client the radcheck row is rewritten and live sessions are kicked so
    the old credentials stop working immediately.
    """
    try:
        customer = Customer.query.get_or_404(customer_id)
        denied = _authorize_customer_secret(customer)
        if denied:
            return denied

        data = request.get_json(silent=True) or {}
        new_password = (data.get('password') or '').strip() or secrets.token_urlsafe(8)
        set_customer_radius_password(customer, new_password)

        isp = ISP.query.get(customer.isp_id) if customer.isp_id else None
        plan = customer.service_plan
        reprovisioned = False
        if customer.status == CustomerStatus.ACTIVE and isp and plan:
            provision_customer_radius(
                customer, plan, isp, password=new_password, throttle=customer.fup_throttled
            )
            from services.hotspot_disconnect import disconnect_customer_on_devices
            try:
                disconnect_customer_on_devices(customer, isp)
            except Exception:
                pass
            reprovisioned = True

        db.session.commit()
        return jsonify({
            'ok': True,
            'message': 'RADIUS password reset',
            'data': {
                'username': radius_username(customer),
                'password': new_password,
                'radius_reprovisioned': reprovisioned,
            },
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to reset credentials: {str(e)}'}), 500


@customers_bp.route('/<int:customer_id>/invoices', methods=['GET'])
@jwt_required()
def get_customer_invoices(customer_id):
    """Get all invoices for a specific customer"""
    try:
        customer = Customer.query.get_or_404(customer_id)
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        status = request.args.get('status')
        
        query = customer.invoices
        
        if status:
            query = query.filter_by(status=status)
        
        invoices = query.order_by(customer.invoices.any().created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return jsonify({
            'customer': serialize_customer(customer),
            'invoices': [invoice.to_dict() for invoice in invoices.items],
            'total': invoices.total,
            'pages': invoices.pages,
            'current_page': page
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get customer invoices: {str(e)}'}), 500

@customers_bp.route('/<int:customer_id>/payments', methods=['GET'])
@jwt_required()
def get_customer_payments(customer_id):
    """Get all payments for a specific customer"""
    try:
        customer = Customer.query.get_or_404(customer_id)
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        status = request.args.get('status')
        
        query = customer.payments
        
        if status:
            query = query.filter_by(status=status)
        
        payments = query.order_by(customer.payments.any().created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return jsonify({
            'customer': serialize_customer(customer),
            'payments': [payment.to_dict() for payment in payments.items],
            'total': payments.total,
            'pages': payments.pages,
            'current_page': page
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get customer payments: {str(e)}'}), 500

@customers_bp.route('/<int:customer_id>/tickets', methods=['GET'])
@jwt_required()
def get_customer_tickets(customer_id):
    """Get all tickets for a specific customer"""
    try:
        customer = Customer.query.get_or_404(customer_id)
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        status = request.args.get('status')
        
        query = customer.tickets
        
        if status:
            query = query.filter_by(status=status)
        
        tickets = query.order_by(customer.tickets.any().created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return jsonify({
            'customer': serialize_customer(customer),
            'tickets': [ticket.to_dict() for ticket in tickets.items],
            'total': tickets.total,
            'pages': tickets.pages,
            'current_page': page
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get customer tickets: {str(e)}'}), 500
