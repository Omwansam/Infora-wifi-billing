"""Deleting a device must account for every table that points at it.

This exists because the list drifted: the delete route handled 4 of the 9
foreign keys onto ``mikrotik_devices``, so deleting a router worked right up
until it had an outage recorded — then it 500'd with an IntegrityError, and the
UI showed a bare "HTTP error! status: 500" because the client never read the
body. Two devices, identical to the operator, behaved differently.

The failure is silent at review time and only appears with the right data
present, so it is checked structurally instead: walk the metadata, and fail if
any FK onto the device table has no decision recorded.

Run: backend/.venv/bin/python -m pytest backend/server/tests -q
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from extensions import db  # noqa: E402
import models  # noqa: E402,F401  (registers every table on db.metadata)
from routes.devices import DEVICE_REFERENCE_CLEANUP  # noqa: E402

DEVICE_TABLE = 'mikrotik_devices'


def _foreign_keys_onto_devices():
    """Every column in the schema that references mikrotik_devices."""
    found = {}
    for table in db.metadata.sorted_tables:
        for column in table.columns:
            for foreign_key in column.foreign_keys:
                if foreign_key.column.table.name == DEVICE_TABLE:
                    found[f'{table.name}.{column.name}'] = column.nullable
    return found


def test_every_foreign_key_onto_devices_has_a_decision():
    """A new FK must be classified, or device deletion breaks for some devices
    and not others depending on which rows happen to exist."""
    actual = set(_foreign_keys_onto_devices())
    declared = set(DEVICE_REFERENCE_CLEANUP)

    missing = actual - declared
    assert not missing, (
        f'These foreign keys point at {DEVICE_TABLE} but the delete route does '
        f'not handle them, so deleting a device with such a row will 500: '
        f'{sorted(missing)}. Add each to DEVICE_REFERENCE_CLEANUP in '
        f'routes/devices.py and handle it in detach_device_references().'
    )

    stale = declared - actual
    assert not stale, (
        f'DEVICE_REFERENCE_CLEANUP names foreign keys that no longer exist: '
        f'{sorted(stale)}'
    )


def test_not_null_references_are_deleted_and_nullable_ones_are_kept():
    """The choice is forced by the schema, not by preference.

    A NOT NULL reference cannot be detached, so the row has to go. A nullable
    one is history or hardware that outlives the router — nulling keeps it.
    Getting this backwards either 500s the delete or destroys records nobody
    asked to remove.
    """
    for reference, nullable in _foreign_keys_onto_devices().items():
        action = DEVICE_REFERENCE_CLEANUP[reference]
        if nullable:
            assert action == 'null', (
                f'{reference} is nullable, so its rows should be kept with the '
                f'reference cleared, not deleted'
            )
        else:
            assert action == 'delete', (
                f'{reference} is NOT NULL, so it cannot be detached — the row '
                f'must be deleted or the device delete will fail'
            )


def test_import_runs_are_kept_not_deleted():
    """A migration's provenance must survive deleting the router it came from.

    import_candidates cascade from import_runs, so deleting the run would take
    the record of which customer came from which secret with it — the only
    thing that makes a run revertible.
    """
    assert DEVICE_REFERENCE_CLEANUP['import_runs.device_id'] == 'null'


def test_backups_are_not_bulk_deleted():
    """device_backups rows own a file on disk, so they go through
    delete_backup() rather than a bulk DELETE that would orphan the file."""
    import inspect

    from routes.devices import detach_device_references

    source = inspect.getsource(detach_device_references)
    assert 'delete_backup(backup)' in source
    assert 'DeviceBackup.query.filter_by(device_id=device.id).delete(' not in source
