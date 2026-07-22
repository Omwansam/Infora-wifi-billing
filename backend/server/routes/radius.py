from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import or_
from models import (
    RadiusClient, User, RadCheck, RadReply, RadUserGroup,
    RadGroupCheck, RadGroupReply, RadAcct, Customer, ServicePlan,
)
from auth_utils import get_current_user
from extensions import db
import os
from datetime import datetime
import socket

# Try to import pyrad, but make it optional
try:
    from pyrad.client import Client
    from pyrad.dictionary import Dictionary
    from pyrad.packet import AccessRequest, AccessAccept, AccessReject
    PYRAD_AVAILABLE = True
except ImportError:
    PYRAD_AVAILABLE = False

radius_bp = Blueprint('radius', __name__, url_prefix='/api/radius')

@radius_bp.route('/clients', methods=['GET'])
@jwt_required()
def get_radius_clients():
    """Get all RADIUS client configurations"""
    try:
        clients = RadiusClient.query.filter_by(is_active=True).all()
        return jsonify({
            'ok': True,
            'message': 'RADIUS clients retrieved successfully',
            'data': [{
                'id': client.id,
                'name': client.name,
                'host': client.host,
                'auth_port': client.auth_port,
                'acct_port': client.acct_port,
                'nas_type': client.nas_type,
                'is_active': client.is_active,
                'created_at': client.created_at.isoformat() if client.created_at else None
            } for client in clients]
        }), 200
    except Exception as e:
        return jsonify({
            'ok': False,
            'message': f'Error retrieving RADIUS clients: {str(e)}'
        }), 500

@radius_bp.route('/clients', methods=['POST'])
@jwt_required()
def create_radius_client():
    """Create a new RADIUS client configuration"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['name', 'host', 'secret']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({
                    'ok': False,
                    'message': f'Missing required field: {field}'
                }), 400
        
        # Create new RADIUS client
        client = RadiusClient(
            name=data['name'],
            host=data['host'],
            secret=data['secret'],
            auth_port=data.get('auth_port', 1812),
            acct_port=data.get('acct_port', 1813),
            nas_type=data.get('nas_type', 'other'),
            shortname=data.get('shortname')
        )
        
        db.session.add(client)
        db.session.commit()
        
        return jsonify({
            'ok': True,
            'message': 'RADIUS client created successfully',
            'data': {
                'id': client.id,
                'name': client.name,
                'host': client.host,
                'auth_port': client.auth_port
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'ok': False,
            'message': f'Error creating RADIUS client: {str(e)}'
        }), 500

@radius_bp.route('/clients/<int:client_id>', methods=['PUT'])
@jwt_required()
def update_radius_client(client_id):
    """Update an existing RADIUS client configuration"""
    try:
        client = RadiusClient.query.get_or_404(client_id)
        data = request.get_json()
        
        # Update fields
        if 'name' in data:
            client.name = data['name']
        if 'host' in data:
            client.host = data['host']
        if 'secret' in data:
            client.secret = data['secret']
        if 'auth_port' in data:
            client.auth_port = data['auth_port']
        if 'acct_port' in data:
            client.acct_port = data['acct_port']
        if 'nas_type' in data:
            client.nas_type = data['nas_type']
        if 'shortname' in data:
            client.shortname = data['shortname']
        if 'is_active' in data:
            client.is_active = data['is_active']
        
        client.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'ok': True,
            'message': 'RADIUS client updated successfully',
            'data': {
                'id': client.id,
                'name': client.name,
                'host': client.host,
                'auth_port': client.auth_port
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'ok': False,
            'message': f'Error updating RADIUS client: {str(e)}'
        }), 500

@radius_bp.route('/clients/<int:client_id>', methods=['DELETE'])
@jwt_required()
def delete_radius_client(client_id):
    """Delete a RADIUS client configuration"""
    try:
        client = RadiusClient.query.get_or_404(client_id)
        client.is_active = False
        client.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'ok': True,
            'message': 'RADIUS client deleted successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'ok': False,
            'message': f'Error deleting RADIUS client: {str(e)}'
        }), 500

def _radius_isp_scope(query, model):
    """Limit a RADIUS-table query to the caller's ISP (admins see all)."""
    user = get_current_user()
    if user and user.role != 'admin' and user.isp_id:
        return query.filter(model.isp_id == user.isp_id), user
    return query, user


@radius_bp.route('/users', methods=['GET'])
@jwt_required()
def get_radius_users():
    """RADIUS auth users from radcheck (Cleartext-Password rows), enriched."""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 25, type=int)
        search = (request.args.get('search') or '').strip()

        query = RadCheck.query.filter(RadCheck.attribute == 'Cleartext-Password')
        query, _user = _radius_isp_scope(query, RadCheck)
        if search:
            query = query.filter(RadCheck.username.ilike(f'%{search}%'))

        paginated = query.order_by(RadCheck.username.asc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        rows = paginated.items
        usernames = [r.username for r in rows]
        cust_ids = [r.customer_id for r in rows if r.customer_id]

        # Batch enrichments
        replies = {}
        groups = {}
        customers = {}
        online = set()
        if usernames:
            for rr in RadReply.query.filter(RadReply.username.in_(usernames)).all():
                replies.setdefault(rr.username, {})[rr.attribute] = rr.value
            for ug in RadUserGroup.query.filter(RadUserGroup.username.in_(usernames)).all():
                groups.setdefault(ug.username, ug.groupname)
            for row in (
                db.session.query(RadAcct.username)
                .filter(RadAcct.acctstoptime.is_(None), RadAcct.username.in_(usernames))
                .distinct()
                .all()
            ):
                online.add((row[0] or '').lower())
        if cust_ids:
            for c in Customer.query.filter(Customer.id.in_(cust_ids)).all():
                customers[c.id] = c

        def _plan_label(groupname):
            if groupname and groupname.startswith('plan_'):
                try:
                    plan = ServicePlan.query.get(int(groupname.split('_', 1)[1]))
                    if plan:
                        return plan.name
                except (ValueError, TypeError):
                    pass
            return groupname

        data = []
        for r in rows:
            cust = customers.get(r.customer_id)
            attrs = replies.get(r.username, {})
            gname = groups.get(r.username)
            data.append({
                'id': r.id,
                'username': r.username,
                'customer_id': r.customer_id,
                'customer_name': cust.full_name if cust else None,
                'customer_status': cust.status.value if cust and cust.status else None,
                'group': gname,
                'plan_name': _plan_label(gname),
                'rate_limit': attrs.get('Mikrotik-Rate-Limit'),
                'expiration': attrs.get('Expiration'),
                'is_online': (r.username or '').lower() in online,
                'is_active': r.is_active,
            })

        return jsonify({
            'ok': True,
            'data': {
                'users': data,
                'total': paginated.total,
                'pages': paginated.pages,
                'current_page': page,
            },
        }), 200
    except Exception as e:
        return jsonify({'ok': False, 'message': f'Failed to load RADIUS users: {str(e)}'}), 500


@radius_bp.route('/groups', methods=['GET'])
@jwt_required()
def get_radius_groups():
    """RADIUS groups from radgroupreply/radgroupcheck, mapped to plans."""
    try:
        reply_q, _user = _radius_isp_scope(RadGroupReply.query, RadGroupReply)
        replies = reply_q.all()

        groups = {}
        for rr in replies:
            groups.setdefault(rr.groupname, {})[rr.attribute] = rr.value

        # Member counts per group
        member_counts = {}
        mc_q, _ = _radius_isp_scope(
            db.session.query(RadUserGroup.groupname, db.func.count(RadUserGroup.id)), RadUserGroup
        )
        for gname, count in mc_q.group_by(RadUserGroup.groupname).all():
            member_counts[gname] = count

        data = []
        for gname, attrs in sorted(groups.items()):
            plan = None
            if gname.startswith('plan_'):
                try:
                    plan = ServicePlan.query.get(int(gname.split('_', 1)[1]))
                except (ValueError, TypeError):
                    plan = None
            data.append({
                'groupname': gname,
                'plan_id': plan.id if plan else None,
                'plan_name': plan.name if plan else gname,
                'rate_limit': attrs.get('Mikrotik-Rate-Limit'),
                'data_cap': attrs.get('Mikrotik-Total-Limit'),
                'attributes': [{'attribute': k, 'value': v} for k, v in attrs.items()],
                'member_count': member_counts.get(gname, 0),
            })

        return jsonify({'ok': True, 'data': {'groups': data, 'total': len(data)}}), 200
    except Exception as e:
        return jsonify({'ok': False, 'message': f'Failed to load RADIUS groups: {str(e)}'}), 500


@radius_bp.route('/auth/<int:client_id>', methods=['POST'])
def authenticate_radius(client_id):
    """Authenticate a user against RADIUS server"""
    if not PYRAD_AVAILABLE:
        return jsonify({
            'ok': False,
            'message': 'PyRAD module not available. Please install pyrad package.'
        }), 503
    
    try:
        client_config = RadiusClient.query.get_or_404(client_id)
        data = request.get_json()
        
        if not data or 'username' not in data or 'password' not in data:
            return jsonify({
                'ok': False,
                'message': 'Username and password are required'
            }), 400
        
        username = data['username']
        password = data['password']
        nas_ip = data.get('nas_ip', '127.0.0.1')
        nas_port = data.get('nas_port', 0)
        
        try:
            # Create RADIUS client
            radius_client = Client(
                server=client_config.host,
                secret=client_config.secret.encode(),
                dict=Dictionary(),
                authport=client_config.auth_port,
                acctport=client_config.acct_port
            )
            
            # Create Access-Request packet
            req = radius_client.CreateAuthPacket(
                code=AccessRequest,
                User_Name=username,
                NAS_IP_Address=nas_ip,
                NAS_Port=nas_port
            )
            
            # Add password
            req["User-Password"] = req.PwCrypt(password)
            
            # Send request and get response
            reply = radius_client.SendPacket(req)
            
            if reply.code == AccessAccept:
                # Authentication successful
                reply_attrs = {}
                for attr in reply.keys():
                    if attr != 'User-Password':  # Don't include password in response
                        reply_attrs[attr] = reply[attr]
                
                return jsonify({
                    'ok': True,
                    'message': 'RADIUS authentication successful',
                    'data': {
                        'authenticated': True,
                        'username': username,
                        'server': client_config.name,
                        'reply_attributes': reply_attrs
                    }
                }), 200
                
            elif reply.code == AccessReject:
                # Authentication failed
                return jsonify({
                    'ok': False,
                    'message': 'RADIUS authentication failed - Access Rejected',
                    'data': {
                        'authenticated': False,
                        'username': username,
                        'server': client_config.name
                    }
                }), 401
                
            else:
                # Unexpected response
                return jsonify({
                    'ok': False,
                    'message': f'Unexpected RADIUS response code: {reply.code}',
                    'data': {
                        'authenticated': False,
                        'username': username,
                        'server': client_config.name,
                        'response_code': reply.code
                    }
                }), 500
                
        except socket.timeout:
            return jsonify({
                'ok': False,
                'message': 'RADIUS server timeout',
                'data': {
                    'authenticated': False,
                    'username': username,
                    'server': client_config.name,
                    'error': 'timeout'
                }
            }), 408
            
        except Exception as radius_error:
            return jsonify({
                'ok': False,
                'message': f'RADIUS authentication error: {str(radius_error)}',
                'data': {
                    'authenticated': False,
                    'username': username,
                    'server': client_config.name,
                    'error': str(radius_error)
                }
            }), 500
            
    except Exception as e:
        return jsonify({
            'ok': False,
            'message': f'Error during RADIUS authentication: {str(e)}'
        }), 500

@radius_bp.route('/test/<int:client_id>', methods=['POST'])
@jwt_required()
def test_radius_connection(client_id):
    """Test RADIUS server connection"""
    if not PYRAD_AVAILABLE:
        return jsonify({
            'ok': False,
            'message': 'PyRAD module not available. Please install pyrad package.'
        }), 503
    
    try:
        client_config = RadiusClient.query.get_or_404(client_id)
        
        try:
            # Create RADIUS client
            radius_client = Client(
                server=client_config.host,
                secret=client_config.secret.encode(),
                dict=Dictionary(),
                authport=client_config.auth_port,
                acctport=client_config.acct_port
            )
            
            # Test with a dummy request
            req = radius_client.CreateAuthPacket(
                code=AccessRequest,
                User_Name="test_user",
                NAS_IP_Address="127.0.0.1",
                NAS_Port=0
            )
            
            # Try to send packet (this will test connectivity)
            reply = radius_client.SendPacket(req)
            
            return jsonify({
                'ok': True,
                'message': 'RADIUS connection test successful',
                'data': {
                    'server': client_config.name,
                    'host': client_config.host,
                    'auth_port': client_config.auth_port,
                    'acct_port': client_config.acct_port,
                    'connection_status': 'success',
                    'response_code': reply.code
                }
            }), 200
            
        except socket.timeout:
            return jsonify({
                'ok': False,
                'message': 'RADIUS server timeout during connection test'
            }), 408
            
        except Exception as radius_error:
            return jsonify({
                'ok': False,
                'message': f'RADIUS connection test failed: {str(radius_error)}'
            }), 500
            
    except Exception as e:
        return jsonify({
            'ok': False,
            'message': f'Error during RADIUS connection test: {str(e)}'
        }), 500
