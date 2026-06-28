"""Create and manage RouterOS configuration backups stored on the server FS."""
import hashlib
import os
import re
from datetime import datetime

from flask import current_app

from extensions import db
from models import DeviceBackup
from services.device_config_ops import export_config


def _backup_dir():
    """Directory where backup files live (configurable via DEVICE_BACKUP_DIR)."""
    configured = os.environ.get('DEVICE_BACKUP_DIR')
    if configured:
        path = configured
    else:
        # backend/server/device_backups
        server_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        path = os.path.join(server_root, 'device_backups')
    os.makedirs(path, exist_ok=True)
    return path


def _safe_name(value):
    return re.sub(r'[^A-Za-z0-9._-]+', '_', (value or 'router')).strip('_') or 'router'


def create_backup(device, user_id=None):
    """Export the device config over SSH and persist it as a .rsc file + DB row.

    Raises on connection/export failure (caller maps to an error response).
    """
    text = export_config(device)
    timestamp = datetime.utcnow().strftime('%Y%m%d-%H%M%S')
    filename = f'{_safe_name(device.device_name)}_{device.id}_{timestamp}.rsc'
    storage_path = os.path.join(_backup_dir(), filename)

    data = text.encode('utf-8')
    with open(storage_path, 'wb') as fh:
        fh.write(data)

    backup = DeviceBackup(
        device_id=device.id,
        isp_id=device.isp_id,
        filename=filename,
        storage_path=storage_path,
        file_format='rsc',
        size_bytes=len(data),
        sha256=hashlib.sha256(data).hexdigest(),
        status='success',
        created_by=user_id,
    )
    device.last_backup_at = datetime.utcnow()
    db.session.add(backup)
    db.session.commit()
    return backup


def list_backups(device_id):
    return (
        DeviceBackup.query.filter_by(device_id=device_id)
        .order_by(DeviceBackup.created_at.desc())
        .all()
    )


def delete_backup(backup):
    """Delete the file (best-effort) and the DB row."""
    try:
        if backup.storage_path and os.path.isfile(backup.storage_path):
            os.remove(backup.storage_path)
    except OSError as exc:
        current_app.logger.warning('Could not remove backup file %s: %s', backup.storage_path, exc)
    db.session.delete(backup)
    db.session.commit()


def serialize_backup(backup):
    return {
        'id': backup.id,
        'device_id': backup.device_id,
        'filename': backup.filename,
        'file_format': backup.file_format,
        'size_bytes': backup.size_bytes,
        'sha256': backup.sha256,
        'status': backup.status,
        'created_at': backup.created_at.isoformat() if backup.created_at else None,
    }
