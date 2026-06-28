from datetime import timedelta

from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    get_jwt,
    get_jwt_identity,
)

from models import User


def _user_additional_claims(user):
    """Extra JWT claims (PyJWT requires sub/identity to be a string)."""
    return {
        'email': user.email,
        'role': user.role,
        'is_admin': user.role == 'admin',
    }


def create_user_tokens(user, access_hours=24, refresh_days=30):
    """Issue access + refresh tokens with string subject (user id)."""
    identity = str(user.id)
    claims = _user_additional_claims(user)
    access_token = create_access_token(
        identity=identity,
        additional_claims=claims,
        expires_delta=timedelta(hours=access_hours),
    )
    refresh_token = create_refresh_token(
        identity=identity,
        additional_claims=claims,
        expires_delta=timedelta(days=refresh_days),
    )
    return access_token, refresh_token


def get_user_id_from_jwt():
    """Extract user id from JWT identity (string id, legacy dict, or email)."""
    identity = get_jwt_identity()
    if isinstance(identity, dict):
        return identity.get('id')
    if identity is not None:
        try:
            return int(identity)
        except (TypeError, ValueError):
            return None
    return None


def get_jwt_user_claims():
    """Read email/role from additional claims or legacy dict identity."""
    identity = get_jwt_identity()
    if isinstance(identity, dict):
        return identity
    claims = get_jwt()
    return {
        'id': get_user_id_from_jwt(),
        'email': claims.get('email'),
        'role': claims.get('role'),
        'is_admin': claims.get('is_admin', False),
    }


def get_current_user():
    """Return the authenticated User row for the current JWT."""
    user_id = get_user_id_from_jwt()
    if user_id:
        return User.query.get(user_id)

    identity = get_jwt_identity()
    if isinstance(identity, str) and '@' in identity:
        return User.query.filter_by(email=identity.lower()).first()

    claims = get_jwt()
    email = claims.get('email')
    if email:
        return User.query.filter_by(email=email.lower()).first()

    return None
