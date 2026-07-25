from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from auth_utils import get_current_user
from extensions import db
from models import ServicePlan, HotspotAccessCode, User, Customer, Invoice, ISP
from routes.customers import serialize_customer
from services.radius_provisioning import ensure_plan_group, reprovision_plan_customers
from services.mikrotik_wireguard import reprovision_plan_wireguard_peers
from services.plan_utils import (
    get_plan_speed_mbps,
    format_plan_speed_hint,
    format_plan_data_cap_display,
    extract_package_policy,
)

plans_bp = Blueprint('plans', __name__, url_prefix='/api/plans')


def _resolve_isp_for_user():
    """ISP a new package should belong to, or None if we cannot tell.

    Mirrors routes.customers._resolve_isp_for_user: an operator is pinned to
    their own ISP, an admin without one falls back to the first active ISP.
    ``service_plans.isp_id`` is NOT NULL, so a package created without this
    fails at commit — that was the "saving does nothing" bug.
    """
    user = get_current_user()
    if not user:
        return None
    if user.isp_id:
        return ISP.query.get(user.isp_id)
    return ISP.query.filter_by(is_active=True).order_by(ISP.id.asc()).first()


def _scope_to_isp(query):
    """Restrict a ServicePlan query to what the current user may see.

    Admins keep the cross-tenant view they have elsewhere; an operator only
    ever sees their own ISP's packages.
    """
    user = get_current_user()
    if user and user.role != 'admin' and user.isp_id:
        return query.filter(ServicePlan.isp_id == user.isp_id)
    return query


def _get_plan_or_403(plan_id):
    """Fetch a plan the current user is allowed to mutate.

    Returns (plan, error_response, status); on success the last two are None.
    """
    plan = ServicePlan.query.get(plan_id)
    if not plan:
        return None, jsonify({'error': 'Package not found'}), 404
    user = get_current_user()
    if user and user.role != 'admin' and user.isp_id and plan.isp_id != user.isp_id:
        return None, jsonify({'error': 'Access denied'}), 403
    return plan, None, None

def serialize_plan(plan):
    """Serialize plan object to dictionary"""
    try:
        # Handle features - convert object to array if needed
        features = plan.features if plan.features else []
        
        if isinstance(features, dict):
            # Convert dict features to array format for frontend with specific naming for icons
            features_list = []
            for key, value in features.items():
                if isinstance(value, bool):
                    if value:
                        if key == 'static_ip':
                            features_list.append("Static IP Address")
                        elif key == 'free_router':
                            features_list.append("Free Router")
                        elif key == 'sla_guarantee':
                            features_list.append("SLA Guarantee")
                        elif key == 'dedicated_support':
                            features_list.append("Dedicated Support")
                        elif key == 'student_discount':
                            features_list.append("Student Discount")
                        elif key == 'senior_discount':
                            features_list.append("Senior Discount")
                        elif key == 'easy_setup':
                            features_list.append("Easy Setup")
                        else:
                            features_list.append(key.replace('_', ' ').title())
                elif key in ['download_speed', 'upload_speed']:
                    if key == 'download_speed':
                        features_list.append(f"Download Speed: {value}")
                    else:
                        features_list.append(f"Upload Speed: {value}")
                elif key == 'devices':
                    if value == 'Unlimited':
                        features_list.append("Unlimited Devices")
                    else:
                        features_list.append(f"Up to {value} Devices")
                elif key == 'support':
                    features_list.append(f"Support: {value}")
                elif key == 'data_cap':
                    features_list.append(f"Data: {value}")
                else:
                    features_list.append(f"{key.replace('_', ' ').title()}: {value}")
            features = features_list
        
        speeds = get_plan_speed_mbps(plan)
        result = {
            'id': plan.id,
            'name': plan.name,
            'speed': plan.speed,
            'description': getattr(plan, 'description', None),
            'bandwidth_limit': getattr(plan, 'bandwidth_limit', None),
            'upload_mbps': speeds['upload_mbps'],
            'download_mbps': speeds['download_mbps'],
            'speed_display': format_plan_speed_hint(plan),
            'data_cap_display': format_plan_data_cap_display(plan),
            'package_policy': extract_package_policy(plan),
            'data_limit': getattr(plan, 'data_limit', None),
            'static_ip': getattr(plan, 'static_ip', None),
            'session_timeout': getattr(plan, 'session_timeout', None),
            'idle_timeout': getattr(plan, 'idle_timeout', None),
            'plan_type': getattr(plan, 'plan_type', 'pppoe'),
            'duration_hours': getattr(plan, 'duration_hours', None),
            'billing_cycle_days': getattr(plan, 'billing_cycle_days', None),
            'wireguard_dns': getattr(plan, 'wireguard_dns', None),
            'wireguard_allowed_ips': getattr(plan, 'wireguard_allowed_ips', None),
            'wireguard_server_id': getattr(plan, 'wireguard_server_id', None),
            'price': float(plan.price) if plan.price else 0.0,
            'features': features,
            'popular': plan.popular,
            'is_active': plan.is_active,
            'created_at': plan.created_at.isoformat() if plan.created_at else None,
            'updated_at': plan.updated_at.isoformat() if plan.updated_at else None,
            'customers_count': len(plan.customers) if hasattr(plan, 'customers') else 0
        }
        return result
    except Exception as e:
        return {
            'id': plan.id,
            'name': plan.name,
            'speed': plan.speed,
            'price': float(plan.price) if plan.price else 0.0,
            'features': [],
            'popular': False,
            'is_active': True,
            'created_at': None,
            'updated_at': None,
            'customers_count': 0
        }

# Add explicit OPTIONS handlers for CORS
@plans_bp.route('/', methods=['OPTIONS'])
def handle_plans_options():
    return '', 200

@plans_bp.route('/<int:plan_id>', methods=['OPTIONS'])
def handle_plan_options(plan_id):
    return '', 200

@plans_bp.route('/active', methods=['OPTIONS'])
def handle_active_options():
    return '', 200

@plans_bp.route('/popular', methods=['OPTIONS'])
def handle_popular_options():
    return '', 200

@plans_bp.route('/stats', methods=['OPTIONS'])
def handle_stats_options():
    return '', 200

@plans_bp.route('/', methods=['GET'])
@jwt_required()
def get_plans():
    """Get all service plans with pagination and filtering"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        is_active = request.args.get('is_active')
        popular = request.args.get('popular')
        search = request.args.get('search')
        plan_type = request.args.get('plan_type')
        
        query = _scope_to_isp(ServicePlan.query)

        if plan_type:
            query = query.filter_by(plan_type=plan_type)
        
        # Filter by active status
        if is_active is not None:
            query = query.filter_by(is_active=is_active.lower() == 'true')
        
        # Filter by popular status
        if popular is not None:
            query = query.filter_by(popular=popular.lower() == 'true')
        
        # Search functionality
        if search:
            search_term = f"%{search}%"
            query = query.filter(ServicePlan.name.ilike(search_term))
        
        # Order by created date
        query = query.order_by(ServicePlan.created_at.desc())
        
        plans = query.paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return jsonify({
            'plans': [serialize_plan(plan) for plan in plans.items],
            'total': plans.total,
            'pages': plans.pages,
            'current_page': page,
            'per_page': per_page
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get plans: {str(e)}'}), 500

@plans_bp.route('/<int:plan_id>', methods=['GET'])
@jwt_required()
def get_plan(plan_id):
    """Get specific service plan by ID"""
    try:
        plan, error, status = _get_plan_or_403(plan_id)
        if error:
            return error, status
        return jsonify(serialize_plan(plan)), 200

    except Exception as e:
        return jsonify({'error': f'Failed to get plan: {str(e)}'}), 500

@plans_bp.route('/', methods=['POST'])
@jwt_required()
def create_plan():
    """Create a new service plan"""
    try:
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return jsonify({'error': 'A JSON body is required'}), 400

        # Validate required fields. Checked for emptiness rather than
        # truthiness: a free trial legitimately posts price 0, and `not 0`
        # would reject it as missing.
        for field in ('name', 'speed', 'price'):
            value = data.get(field)
            if value is None or (isinstance(value, str) and not value.strip()):
                return jsonify({'error': f'{field} is required'}), 400

        # Validate price
        try:
            price = float(data['price'])
        except (TypeError, ValueError):
            return jsonify({'error': 'Invalid price format'}), 400
        if price < 0:
            return jsonify({'error': 'Price must be positive'}), 400

        # Validate plan type
        plan_type = (data.get('plan_type') or 'pppoe').strip().lower()
        allowed_types = ('pppoe', 'hotspot', 'trial', 'bundle', 'wireguard')
        if plan_type not in allowed_types:
            return jsonify({'error': f'Invalid plan_type. Use one of: {", ".join(allowed_types)}'}), 400

        isp = _resolve_isp_for_user()
        if not isp:
            return jsonify({'error': 'No ISP associated with this account'}), 400

        # Create plan
        plan = ServicePlan(
            name=data['name'],
            speed=data['speed'],
            price=price,
            features=data.get('features') or {},
            popular=data.get('popular', False),
            is_active=data.get('is_active', True),
            plan_type=plan_type,
            bandwidth_limit=data.get('bandwidth_limit'),
            data_limit=data.get('data_limit'),
            static_ip=data.get('static_ip'),
            session_timeout=data.get('session_timeout'),
            idle_timeout=data.get('idle_timeout'),
            duration_hours=data.get('duration_hours'),
            billing_cycle_days=data.get('billing_cycle_days', 30),
            isp_id=isp.id,
        )

        db.session.add(plan)
        db.session.commit()

        # Give the package its RADIUS group up front so the first customer
        # assigned to it authenticates with the right rate limit. Best effort:
        # the package is already saved, so a RADIUS hiccup must not 500 the
        # create and lose the operator's work.
        warning = None
        if plan_type != 'wireguard':
            try:
                ensure_plan_group(plan, isp)
                db.session.commit()
            except Exception as provision_error:
                db.session.rollback()
                warning = f'Package saved, but RADIUS setup failed: {provision_error}'

        payload = {
            'message': 'Service plan created successfully',
            'plan': serialize_plan(plan)
        }
        if warning:
            payload['warning'] = warning
        return jsonify(payload), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to create plan: {str(e)}'}), 500

@plans_bp.route('/<int:plan_id>', methods=['PUT'])
@jwt_required()
def update_plan(plan_id):
    """Update service plan"""
    try:
        plan, error, status = _get_plan_or_403(plan_id)
        if error:
            return error, status
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return jsonify({'error': 'A JSON body is required'}), 400

        radius_fields = (
            'bandwidth_limit', 'data_limit', 'static_ip',
            'session_timeout', 'idle_timeout', 'speed', 'features', 'plan_type',
            'duration_hours', 'billing_cycle_days',
            'wireguard_dns', 'wireguard_allowed_ips', 'wireguard_server_id',
        )
        radius_changed = False

        # Update fields
        if 'name' in data:
            name = (data['name'] or '').strip()
            if not name:
                return jsonify({'error': 'name is required'}), 400
            plan.name = name
        if 'speed' in data:
            speed = (data['speed'] or '').strip()
            if not speed:
                return jsonify({'error': 'speed is required'}), 400
            plan.speed = speed
            radius_changed = True
        if 'price' in data:
            try:
                price = float(data['price'])
            except (TypeError, ValueError):
                return jsonify({'error': 'Invalid price format'}), 400
            if price < 0:
                return jsonify({'error': 'Price must be positive'}), 400
            plan.price = price
        if 'plan_type' in data:
            plan_type = (data.get('plan_type') or '').strip().lower()
            allowed_types = ('pppoe', 'hotspot', 'trial', 'bundle', 'wireguard')
            if plan_type not in allowed_types:
                return jsonify({'error': f'Invalid plan_type. Use one of: {", ".join(allowed_types)}'}), 400
            data = {**data, 'plan_type': plan_type}
        if 'features' in data:
            plan.features = data['features'] or {}
            radius_changed = True
        if 'popular' in data:
            plan.popular = data['popular']
        if 'is_active' in data:
            plan.is_active = data['is_active']
        for field in radius_fields:
            if field in data and field not in ('speed', 'features'):
                setattr(plan, field, data[field])
                radius_changed = True

        # Persist first: reprovisioning talks to RADIUS/WireGuard and must not
        # be able to roll back an otherwise valid edit.
        db.session.commit()

        warning = None
        if radius_changed:
            isp = ISP.query.get(plan.isp_id)
            if isp:
                try:
                    if plan.plan_type == 'wireguard':
                        reprovision_plan_wireguard_peers(plan)
                    else:
                        ensure_plan_group(plan, isp)
                        reprovision_plan_customers(plan)
                    db.session.commit()
                except Exception as provision_error:
                    db.session.rollback()
                    warning = f'Package saved, but re-provisioning failed: {provision_error}'

        payload = {
            'message': 'Service plan updated successfully',
            'plan': serialize_plan(plan)
        }
        if warning:
            payload['warning'] = warning
        return jsonify(payload), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update plan: {str(e)}'}), 500

@plans_bp.route('/<int:plan_id>', methods=['DELETE'])
@jwt_required()
def delete_plan(plan_id):
    """Delete service plan"""
    try:
        plan, error, status = _get_plan_or_403(plan_id)
        if error:
            return error, status

        # Check if plan has related customers
        customer_count = len(plan.customers) if hasattr(plan, 'customers') else 0

        if customer_count > 0:
            return jsonify({
                'error': f'Cannot delete a package still assigned to {customer_count} '
                         f'client{"s" if customer_count != 1 else ""}. '
                         'Move them to another package first.'
            }), 400

        # hotspot_access_codes.plan_id is NOT NULL, so issued codes block the
        # delete at the FK. Say so plainly instead of surfacing a driver error.
        code_count = HotspotAccessCode.query.filter_by(plan_id=plan.id).count()
        if code_count > 0:
            return jsonify({
                'error': f'Cannot delete a package with {code_count} issued hotspot '
                         f'access code{"s" if code_count != 1 else ""}. '
                         'Deactivate the package instead.'
            }), 400

        try:
            db.session.delete(plan)
            db.session.commit()
            
            return jsonify({'message': 'Service plan deleted successfully'}), 200
            
        except Exception as delete_error:
            db.session.rollback()
            
            if "foreign key constraint" in str(delete_error).lower():
                return jsonify({'error': 'Cannot delete plan with related data (customers, etc.)'}), 400
            else:
                raise delete_error
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to delete plan: {str(e)}'}), 500

@plans_bp.route('/<int:plan_id>/toggle-active', methods=['PUT'])
@jwt_required()
def toggle_plan_active(plan_id):
    """Toggle plan active status"""
    try:
        plan, error, status = _get_plan_or_403(plan_id)
        if error:
            return error, status
        plan.is_active = not plan.is_active

        db.session.commit()
        
        return jsonify({
            'message': f'Plan {"activated" if plan.is_active else "deactivated"} successfully',
            'plan': serialize_plan(plan)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to toggle plan status: {str(e)}'}), 500

@plans_bp.route('/<int:plan_id>/toggle-popular', methods=['PUT'])
@jwt_required()
def toggle_plan_popular(plan_id):
    """Toggle plan popular status"""
    try:
        plan, error, status = _get_plan_or_403(plan_id)
        if error:
            return error, status
        plan.popular = not plan.popular

        db.session.commit()
        
        return jsonify({
            'message': f'Plan {"marked as popular" if plan.popular else "unmarked as popular"} successfully',
            'plan': serialize_plan(plan)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to toggle plan popular status: {str(e)}'}), 500

@plans_bp.route('/active', methods=['GET'])
@jwt_required()
def get_active_plans():
    """Get all active service plans"""
    try:
        query = _scope_to_isp(ServicePlan.query).filter_by(is_active=True)
        plan_type = request.args.get('plan_type')
        if plan_type:
            query = query.filter_by(plan_type=plan_type)
        plans = query.order_by(ServicePlan.price.asc()).all()
        
        return jsonify({
            'plans': [serialize_plan(plan) for plan in plans]
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get active plans: {str(e)}'}), 500

@plans_bp.route('/popular', methods=['GET'])
@jwt_required()
def get_popular_plans():
    """Get all popular service plans"""
    try:
        plans = _scope_to_isp(ServicePlan.query).filter_by(
            popular=True, is_active=True
        ).order_by(ServicePlan.price.asc()).all()
        
        return jsonify({
            'plans': [serialize_plan(plan) for plan in plans]
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get popular plans: {str(e)}'}), 500

@plans_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_plan_stats():
    """Get service plan statistics"""
    try:
        # Every figure below is scoped the same way the package list is, so the
        # cards on the page always add up to the rows underneath them.
        total_plans = _scope_to_isp(ServicePlan.query).count()
        active_plans = _scope_to_isp(ServicePlan.query).filter_by(is_active=True).count()
        popular_plans = _scope_to_isp(ServicePlan.query).filter_by(popular=True).count()

        prices = _scope_to_isp(db.session.query(ServicePlan.price)).subquery()
        avg_price = db.session.query(db.func.avg(prices.c.price)).scalar() or 0
        min_price = db.session.query(db.func.min(prices.c.price)).scalar() or 0
        max_price = db.session.query(db.func.max(prices.c.price)).scalar() or 0

        # Plans by price range
        plans_by_range = {
            'budget': _scope_to_isp(ServicePlan.query).filter(ServicePlan.price < 50).count(),
            'standard': _scope_to_isp(ServicePlan.query).filter(ServicePlan.price >= 50, ServicePlan.price < 100).count(),
            'premium': _scope_to_isp(ServicePlan.query).filter(ServicePlan.price >= 100).count()
        }

        return jsonify({
            'total_plans': total_plans,
            'active_plans': active_plans,
            'popular_plans': popular_plans,
            'average_price': float(avg_price),
            'price_range': {
                'min': float(min_price),
                'max': float(max_price)
            },
            'plans_by_price_range': plans_by_range
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get plan stats: {str(e)}'}), 500

@plans_bp.route('/<int:plan_id>/customers', methods=['GET'])
@jwt_required()
def get_plan_customers(plan_id):
    """Get all customers using a specific plan"""
    try:
        plan, error, status = _get_plan_or_403(plan_id)
        if error:
            return error, status
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        # Get customers directly through the relationship
        customers = plan.customers
        
        # Manual pagination since we're working with a list
        start_idx = (page - 1) * per_page
        end_idx = start_idx + per_page
        paginated_customers = customers[start_idx:end_idx]
        
        total_customers = len(customers)
        total_pages = (total_customers + per_page - 1) // per_page
        
        return jsonify({
            'plan': serialize_plan(plan),
            'customers': [serialize_customer(customer) for customer in paginated_customers],
            'total': total_customers,
            'pages': total_pages,
            'current_page': page
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get plan customers: {str(e)}'}), 500

@plans_bp.route('/bulk-update', methods=['PUT'])
@jwt_required()
def bulk_update_plans():
    """Bulk update multiple plans"""
    try:
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return jsonify({'error': 'A JSON body is required'}), 400
        plan_ids = data.get('plan_ids', [])
        updates = data.get('updates', {})

        if not plan_ids:
            return jsonify({'error': 'No plan IDs provided'}), 400
        
        if not updates:
            return jsonify({'error': 'No updates provided'}), 400
        
        # Validate updates
        allowed_fields = ['is_active', 'popular', 'price', 'features']
        for field in updates:
            if field not in allowed_fields:
                return jsonify({'error': f'Field {field} is not allowed for bulk update'}), 400
        
        if 'price' in updates:
            try:
                price = float(updates['price'])
            except (TypeError, ValueError):
                return jsonify({'error': 'Invalid price format'}), 400
            if price < 0:
                return jsonify({'error': 'Price must be positive'}), 400
            updates = {**updates, 'price': price}

        # Update plans — silently skipping anything outside the caller's ISP.
        updated_count = 0
        for plan_id in plan_ids:
            plan, _error, _status = _get_plan_or_403(plan_id)
            if plan:
                for field, value in updates.items():
                    setattr(plan, field, value)
                updated_count += 1

        db.session.commit()
        
        return jsonify({
            'message': f'Successfully updated {updated_count} plans',
            'updated_count': updated_count
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to bulk update plans: {str(e)}'}), 500
