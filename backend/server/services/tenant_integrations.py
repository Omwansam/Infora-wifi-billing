"""Read a tenant's own gateway credentials out of ``integration_settings``.

Settings > Communications and Settings > Email write into ``IntegrationSetting``
rows, where any field whose name looks like a credential is Fernet-encrypted by
``routes/settings.py``. This module is the read side: it hands a service back a
plain dict with the secrets decrypted, or ``None`` when the tenant has not
configured that gateway.

Two rules are deliberate.

**Enabled means enabled.** A row with ``enabled = False`` is treated as absent,
so switching "Custom SMTP" off in the UI really does put delivery back on the
platform default without anyone having to clear the fields first.

**All-or-nothing per source.** Callers get either the tenant's whole config or
the platform's, never a blend. Falling back field-by-field would happily pair a
tenant's mail host with the platform's password, and the resulting
authentication failure looks nothing like its cause — it reads as "the server
rejected our password" when the real problem is that two halves of two accounts
were stapled together. A partial tenant config is refused loudly instead.
"""
from __future__ import annotations

import json
import logging

from models import IntegrationSetting
from services.encryption import decrypt_value

logger = logging.getLogger(__name__)

# Mirrors _is_secret_field in routes/settings.py — the two must agree, or a
# value encrypted on write is handed back as ciphertext on read.
_SECRET_HINTS = ('key', 'secret', 'token', 'password', 'passkey')


def _is_secret(name):
    n = (name or '').lower()
    return any(hint in n for hint in _SECRET_HINTS)


def integration_config(isp, key, required=()):
    """Decrypted config for one integration, or ``None``.

    Returns ``None`` when the tenant has no row, has it switched off, or has
    left one of ``required`` blank — all three mean "fall back to the platform".
    """
    isp_id = getattr(isp, 'id', None)
    if not isp_id:
        return None

    row = IntegrationSetting.query.filter_by(isp_id=isp_id, key=key).first()
    if row is None or not row.enabled:
        return None

    try:
        raw = json.loads(row.config) if row.config else {}
    except (ValueError, TypeError):
        logger.warning('Integration %s for isp=%s has unreadable config', key, isp_id)
        return None

    config = {
        name: (decrypt_value(value) if _is_secret(name) and value else value)
        for name, value in (raw or {}).items()
    }

    missing = [name for name in required if not str(config.get(name) or '').strip()]
    if missing:
        logger.warning(
            'Integration %s for isp=%s is enabled but missing %s — using the platform default',
            key, isp_id, ', '.join(missing),
        )
        return None

    return config
