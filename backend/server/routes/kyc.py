import os
import uuid
from datetime import datetime

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import jwt_required
from sqlalchemy import or_
from werkzeug.utils import secure_filename

from extensions import db
from models import Customer, CustomerDocument, KycStatus
from routes.customers import serialize_customer

kyc_bp = Blueprint('kyc', __name__, url_prefix='/api/kyc')

KYC_DOCUMENT_TYPES = {
    'national_id',
    'passport',
    'proof_of_address',
    'selfie',
    'business_registration',
}


def serialize_document(document):
    return {
        'id': document.id,
        'customer_id': document.customer_id,
        'document_type': document.document_type,
        'file_name': document.file_name,
        'original_file_name': document.original_file_name,
        'file_size': document.file_size,
        'file_path': document.file_path,
        'verification_status': document.verification_status,
        'notes': document.notes,
        'upload_date': document.upload_date.isoformat() if document.upload_date else None,
        'expiry_date': document.expiry_date.isoformat() if document.expiry_date else None,
        'is_active': document.is_active,
        'created_at': document.created_at.isoformat() if document.created_at else None,
    }


def serialize_kyc_record(customer):
    data = serialize_customer(customer)
    documents = sorted(
        list(customer.documents),
        key=lambda doc: doc.created_at or datetime.min,
        reverse=True,
    )

    data.update({
        'id_number': customer.id_number,
        'kyc_status': customer.kyc_status.value if customer.kyc_status else 'pending',
        'kyc_verified_at': customer.kyc_verified_at.isoformat() if customer.kyc_verified_at else None,
        'kyc_notes': customer.kyc_notes,
        'documents': [serialize_document(doc) for doc in documents],
        'documents_count': len(documents),
        'approved_documents': sum(1 for doc in documents if doc.verification_status == 'approved'),
    })
    return data


def parse_kyc_status(value):
    try:
        return KycStatus(value)
    except ValueError:
        return None


@kyc_bp.route('/', methods=['OPTIONS'])
@kyc_bp.route('/stats', methods=['OPTIONS'])
def kyc_options():
    return '', 200


@kyc_bp.route('/', methods=['GET'])
@jwt_required()
def list_kyc_records():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        search = request.args.get('search', '').strip()
        status = request.args.get('status')

        query = Customer.query

        if status and status != 'all':
            status_enum = parse_kyc_status(status)
            if not status_enum:
                return jsonify({'error': 'Invalid KYC status'}), 400
            query = query.filter_by(kyc_status=status_enum)

        if search:
            like = f'%{search}%'
            query = query.filter(
                or_(
                    Customer.full_name.ilike(like),
                    Customer.email.ilike(like),
                    Customer.phone.ilike(like),
                    Customer.id_number.ilike(like),
                )
            )

        pagination = query.order_by(Customer.updated_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )

        return jsonify({
            'records': [serialize_kyc_record(customer) for customer in pagination.items],
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': page,
            'per_page': per_page,
        }), 200
    except Exception as exc:
        return jsonify({'error': f'Failed to load KYC records: {str(exc)}'}), 500


@kyc_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_kyc_stats():
    try:
        return jsonify({
            'total_records': Customer.query.count(),
            'pending': Customer.query.filter_by(kyc_status=KycStatus.PENDING).count(),
            'under_review': Customer.query.filter_by(kyc_status=KycStatus.UNDER_REVIEW).count(),
            'verified': Customer.query.filter_by(kyc_status=KycStatus.VERIFIED).count(),
            'rejected': Customer.query.filter_by(kyc_status=KycStatus.REJECTED).count(),
            'documents_pending': CustomerDocument.query.filter_by(verification_status='pending').count(),
        }), 200
    except Exception as exc:
        return jsonify({'error': f'Failed to load KYC stats: {str(exc)}'}), 500


@kyc_bp.route('/<int:customer_id>', methods=['GET'])
@jwt_required()
def get_kyc_record(customer_id):
    try:
        customer = Customer.query.get_or_404(customer_id)
        return jsonify(serialize_kyc_record(customer)), 200
    except Exception as exc:
        return jsonify({'error': f'Failed to load KYC record: {str(exc)}'}), 500


@kyc_bp.route('/<int:customer_id>', methods=['PUT'])
@jwt_required()
def update_kyc_record(customer_id):
    try:
        customer = Customer.query.get_or_404(customer_id)
        data = request.get_json() or {}

        if 'id_number' in data:
            customer.id_number = data['id_number']
        if 'kyc_notes' in data:
            customer.kyc_notes = data['kyc_notes']

        db.session.commit()
        return jsonify({
            'message': 'KYC record updated',
            'record': serialize_kyc_record(customer),
        }), 200
    except Exception as exc:
        db.session.rollback()
        return jsonify({'error': f'Failed to update KYC record: {str(exc)}'}), 500


@kyc_bp.route('/<int:customer_id>/status', methods=['PUT'])
@jwt_required()
def update_kyc_status(customer_id):
    try:
        customer = Customer.query.get_or_404(customer_id)
        data = request.get_json() or {}
        new_status = data.get('kyc_status')

        status_enum = parse_kyc_status(new_status)
        if not status_enum:
            return jsonify({'error': 'Valid kyc_status is required'}), 400

        customer.kyc_status = status_enum
        customer.kyc_notes = data.get('kyc_notes', customer.kyc_notes)

        if status_enum == KycStatus.VERIFIED:
            customer.kyc_verified_at = datetime.utcnow()
        elif status_enum in (KycStatus.PENDING, KycStatus.UNDER_REVIEW, KycStatus.REJECTED):
            customer.kyc_verified_at = None

        db.session.commit()
        return jsonify({
            'message': f'KYC status updated to {status_enum.value}',
            'record': serialize_kyc_record(customer),
        }), 200
    except Exception as exc:
        db.session.rollback()
        return jsonify({'error': f'Failed to update KYC status: {str(exc)}'}), 500


@kyc_bp.route('/<int:customer_id>/documents', methods=['GET'])
@jwt_required()
def list_customer_documents(customer_id):
    try:
        customer = Customer.query.get_or_404(customer_id)
        documents = CustomerDocument.query.filter_by(customer_id=customer.id).order_by(
            CustomerDocument.created_at.desc()
        ).all()
        return jsonify({
            'customer_id': customer.id,
            'documents': [serialize_document(doc) for doc in documents],
        }), 200
    except Exception as exc:
        return jsonify({'error': f'Failed to load documents: {str(exc)}'}), 500


@kyc_bp.route('/<int:customer_id>/documents', methods=['POST'])
@jwt_required()
def create_customer_document(customer_id):
    try:
        customer = Customer.query.get_or_404(customer_id)
        data = request.form.to_dict() if request.files else (request.get_json() or {})

        document_type = (data.get('document_type') or '').strip()
        if document_type not in KYC_DOCUMENT_TYPES:
            return jsonify({'error': f'Invalid document_type. Allowed: {", ".join(sorted(KYC_DOCUMENT_TYPES))}'}), 400

        upload_root = current_app.config.get('UPLOAD_FOLDER', 'uploads')
        customer_dir = os.path.join(upload_root, 'kyc', str(customer_id))
        os.makedirs(customer_dir, exist_ok=True)

        uploaded_file = request.files.get('file') if request.files else None
        if uploaded_file and uploaded_file.filename:
            original_name = secure_filename(uploaded_file.filename)
            stored_name = f'{uuid.uuid4().hex}_{original_name}'
            file_path = os.path.join(customer_dir, stored_name)
            uploaded_file.save(file_path)
            file_size = os.path.getsize(file_path)
        else:
            original_name = data.get('original_file_name') or data.get('file_name') or f'{document_type}.pdf'
            stored_name = secure_filename(data.get('file_name') or f'{document_type}_{uuid.uuid4().hex[:8]}.pdf')
            file_path = os.path.join(customer_dir, stored_name)
            file_size = int(data.get('file_size') or 0)
            if not os.path.exists(file_path):
                with open(file_path, 'wb') as placeholder:
                    placeholder.write(b'')

        expiry_date = None
        if data.get('expiry_date'):
            expiry_date = datetime.fromisoformat(str(data['expiry_date']).replace('Z', '+00:00'))

        document = CustomerDocument(
            customer_id=customer.id,
            document_type=document_type,
            file_name=stored_name,
            original_file_name=original_name,
            file_size=file_size,
            file_path=file_path,
            expiry_date=expiry_date,
            verification_status='pending',
            notes=data.get('notes'),
        )
        db.session.add(document)

        if customer.kyc_status == KycStatus.PENDING:
            customer.kyc_status = KycStatus.UNDER_REVIEW

        db.session.commit()

        return jsonify({
            'message': 'Document uploaded successfully',
            'document': serialize_document(document),
            'record': serialize_kyc_record(customer),
        }), 201
    except Exception as exc:
        db.session.rollback()
        return jsonify({'error': f'Failed to upload document: {str(exc)}'}), 500


@kyc_bp.route('/documents/<int:document_id>/verify', methods=['PUT'])
@jwt_required()
def verify_document(document_id):
    try:
        document = CustomerDocument.query.get_or_404(document_id)
        data = request.get_json() or {}
        verification_status = data.get('verification_status')

        if verification_status not in {'approved', 'rejected', 'pending'}:
            return jsonify({'error': 'verification_status must be approved, rejected, or pending'}), 400

        document.verification_status = verification_status
        document.notes = data.get('notes', document.notes)
        customer = document.customer

        if verification_status == 'rejected':
            customer.kyc_status = KycStatus.REJECTED
        elif verification_status == 'approved':
            docs = CustomerDocument.query.filter_by(customer_id=customer.id, is_active=True).all()
            required_types = {'national_id', 'proof_of_address'}
            approved_types = {doc.document_type for doc in docs if doc.verification_status == 'approved'}
            if required_types.issubset(approved_types):
                customer.kyc_status = KycStatus.VERIFIED
                customer.kyc_verified_at = datetime.utcnow()
            else:
                customer.kyc_status = KycStatus.UNDER_REVIEW

        db.session.commit()
        return jsonify({
            'message': 'Document verification updated',
            'document': serialize_document(document),
            'record': serialize_kyc_record(customer),
        }), 200
    except Exception as exc:
        db.session.rollback()
        return jsonify({'error': f'Failed to verify document: {str(exc)}'}), 500


@kyc_bp.route('/documents/<int:document_id>', methods=['DELETE'])
@jwt_required()
def delete_document(document_id):
    try:
        document = CustomerDocument.query.get_or_404(document_id)
        customer = document.customer
        db.session.delete(document)
        db.session.commit()
        return jsonify({
            'message': 'Document deleted',
            'record': serialize_kyc_record(customer),
        }), 200
    except Exception as exc:
        db.session.rollback()
        return jsonify({'error': f'Failed to delete document: {str(exc)}'}), 500
