"""Lightweight activity logging into the SystemLog table.

Records go to `system_logs` and are surfaced on Settings → System Logs
(GET /api/settings/logs). Writing is best-effort: a logging failure must never
break the request that triggered it, so every call is wrapped and the row is
flushed on its own nested transaction where possible.
"""
import logging
from datetime import datetime

from extensions import db
from models import SystemLog

logger = logging.getLogger(__name__)

VALID_LEVELS = ('INFO', 'WARNING', 'ERROR')


def record_system_log(log_type, message, level='INFO', user_id=None, commit=False):
    """Insert a SystemLog row. Best-effort — never raises.

    log_type: short category, e.g. 'auth', 'user', 'settings'.
    level: INFO | WARNING | ERROR.
    commit: commit immediately (use from flows that don't otherwise commit).
    """
    level = (level or 'INFO').upper()
    if level not in VALID_LEVELS:
        level = 'INFO'
    try:
        entry = SystemLog(
            log_type=(log_type or 'system')[:50],
            log_message=str(message),
            log_level=level,
            log_timestamp=datetime.utcnow(),
            user_id=user_id,
        )
        db.session.add(entry)
        if commit:
            db.session.commit()
        else:
            db.session.flush()
    except Exception as exc:  # pragma: no cover - logging must not break callers
        logger.debug('record_system_log failed: %s', exc)
        try:
            db.session.rollback()
        except Exception:
            pass
