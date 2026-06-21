from flask_jwt_extended import get_jwt_identity
from models import User


def get_user_id_from_jwt():
    """Extract user id from JWT identity (dict or legacy int/str)."""
    identity = get_jwt_identity()
    if isinstance(identity, dict):
        return identity.get('id')
    if identity is not None:
        try:
            return int(identity)
        except (TypeError, ValueError):
            return None
    return None


def get_current_user():
    """Return the authenticated User row for the current JWT."""
    user_id = get_user_id_from_jwt()
    if user_id:
        return User.query.get(user_id)

    identity = get_jwt_identity()
    if isinstance(identity, str) and '@' in identity:
        return User.query.filter_by(email=identity.lower()).first()

    return None
