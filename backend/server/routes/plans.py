from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models import ServicePlan, User, Customer, Invoice
from routes.customers import serialize_customer

plans_bp = Blueprint('plans', __name__, url_prefix='/api/plans')

def serialize_plan(plan):
    """Serialize plan object to dictionary"""
    try:
        # Handle features - convert object to array if needed
        features = plan.features if plan.features else []
        print(f"DEBUG: Plan {plan.name} - Raw features: {features}")
        print(f"DEBUG: Plan {plan.name} - Features type: {type(features)}")
        
        if isinstance(features, dict):
            print(f"DEBUG: Plan {plan.name} - Converting dict to array")
            # Convert dict features to array format for frontend with specific naming for icons
            features_list = []
            for key, value in features.items():
                print(f"DEBUG: Processing {key} = {value}")
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
            print(f"DEBUG: Plan {plan.name} - Converted features: {features}")
        else:
            print(f"DEBUG: Plan {plan.name} - Features is not a dict, type: {type(features)}")
        
        result = {
            'id': plan.id,
            'name': plan.name,
            'speed': plan.speed,
            'price': float(plan.price) if plan.price else 0.0,
            'features': features,
            'popular': plan.popular,
            'is_active': plan.is_active,
            'created_at': plan.created_at.isoformat() if plan.created_at else None,
            'updated_at': plan.updated_at.isoformat() if plan.updated_at else None,
            'customers_count': len(plan.customers) if hasattr(plan, 'customers') else 0
        }
        print(f"DEBUG: Plan {plan.name} - Final features: {result['features']}")
        return result
    except Exception as e:
        print(f"Error serializing plan {plan.id}: {e}")
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
        
        query = ServicePlan.query
        
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
        plan = ServicePlan.query.get_or_404(plan_id)
        return jsonify(serialize_plan(plan)), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get plan: {str(e)}'}), 500

@plans_bp.route('/', methods=['POST'])
@jwt_required()
def create_plan():
    """Create a new service plan"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['name', 'speed', 'price']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        # Validate price
        try:
            price = float(data['price'])
            if price < 0:
                return jsonify({'error': 'Price must be positive'}), 400
        except ValueError:
            return jsonify({'error': 'Invalid price format'}), 400
        
        # Create plan
        plan = ServicePlan(
            name=data['name'],
            speed=data['speed'],
            price=price,
            features=data.get('features', []),
            popular=data.get('popular', False),
            is_active=data.get('is_active', True)
        )
        
        db.session.add(plan)
        db.session.commit()
        
        return jsonify({
            'message': 'Service plan created successfully',
            'plan': serialize_plan(plan)
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to create plan: {str(e)}'}), 500

@plans_bp.route('/<int:plan_id>', methods=['PUT'])
@jwt_required()
def update_plan(plan_id):
    """Update service plan"""
    try:
        plan = ServicePlan.query.get_or_404(plan_id)
        data = request.get_json()
        
        # Update fields
        if 'name' in data:
            plan.name = data['name']
        if 'speed' in data:
            plan.speed = data['speed']
        if 'price' in data:
            try:
                price = float(data['price'])
                if price < 0:
                    return jsonify({'error': 'Price must be positive'}), 400
                plan.price = price
            except ValueError:
                return jsonify({'error': 'Invalid price format'}), 400
        if 'features' in data:
            plan.features = data['features']
        if 'popular' in data:
            plan.popular = data['popular']
        if 'is_active' in data:
            plan.is_active = data['is_active']
        
        db.session.commit()
        
        return jsonify({
            'message': 'Service plan updated successfully',
            'plan': serialize_plan(plan)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update plan: {str(e)}'}), 500

@plans_bp.route('/<int:plan_id>', methods=['DELETE'])
@jwt_required()
def delete_plan(plan_id):
    """Delete service plan"""
    try:
        print(f"DELETE /api/plans/{plan_id} - Request received")
        
        plan = ServicePlan.query.get_or_404(plan_id)
        print(f"Found plan: {plan.name}")
        
        # Check if plan has related customers
        customer_count = len(plan.customers) if hasattr(plan, 'customers') else 0
        print(f"Plan has {customer_count} customers")
        
        if customer_count > 0:
            return jsonify({'error': 'Cannot delete plan with existing customers'}), 400
        
        try:
            db.session.delete(plan)
            db.session.commit()
            print(f"Plan {plan.name} deleted successfully")
            
            return jsonify({'message': 'Service plan deleted successfully'}), 200
            
        except Exception as delete_error:
            db.session.rollback()
            print(f"Delete error: {delete_error}")
            
            if "foreign key constraint" in str(delete_error).lower():
                return jsonify({'error': 'Cannot delete plan with related data (customers, etc.)'}), 400
            else:
                raise delete_error
        
    except Exception as e:
        db.session.rollback()
        print(f"Delete plan error: {type(e).__name__}: {e}")
        return jsonify({'error': f'Failed to delete plan: {str(e)}'}), 500

@plans_bp.route('/<int:plan_id>/toggle-active', methods=['PUT'])
@jwt_required()
def toggle_plan_active(plan_id):
    """Toggle plan active status"""
    try:
        plan = ServicePlan.query.get_or_404(plan_id)
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
        plan = ServicePlan.query.get_or_404(plan_id)
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
        plans = ServicePlan.query.filter_by(is_active=True).order_by(ServicePlan.price.asc()).all()
        
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
        plans = ServicePlan.query.filter_by(popular=True, is_active=True).order_by(ServicePlan.price.asc()).all()
        
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
        total_plans = ServicePlan.query.count()
        active_plans = ServicePlan.query.filter_by(is_active=True).count()
        popular_plans = ServicePlan.query.filter_by(popular=True).count()
        
        # Average price
        avg_price = db.session.query(db.func.avg(ServicePlan.price)).scalar() or 0
        
        # Price range
        min_price = db.session.query(db.func.min(ServicePlan.price)).scalar() or 0
        max_price = db.session.query(db.func.max(ServicePlan.price)).scalar() or 0
        
        # Plans by price range
        plans_by_range = {
            'budget': ServicePlan.query.filter(ServicePlan.price < 50).count(),
            'standard': ServicePlan.query.filter(ServicePlan.price >= 50, ServicePlan.price < 100).count(),
            'premium': ServicePlan.query.filter(ServicePlan.price >= 100).count()
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
        plan = ServicePlan.query.get_or_404(plan_id)
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
        data = request.get_json()
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
        
        # Update plans
        updated_count = 0
        for plan_id in plan_ids:
            plan = ServicePlan.query.get(plan_id)
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
