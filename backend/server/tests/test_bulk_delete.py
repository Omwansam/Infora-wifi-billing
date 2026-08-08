"""Tests for bulk subscriber deletion.

This endpoint permanently destroys customer records, so the tests here are less
about happy paths and more about the three ways it could do damage it was never
asked to do:

  1. Deleting another tenant's subscribers.
  2. Deleting more rows than the operator confirmed.
  3. Being reachable by someone who should not have it.

Run: backend/.venv/bin/python -m pytest backend/server/tests -q
"""
import os
import sys

import pytest
from flask import Flask

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from extensions import db  # noqa: E402
from models import Customer, CustomerStatus, ISP, User  # noqa: E402


@pytest.fixture()
def app():
    application = Flask(__name__)
    application.config.update(
        SQLALCHEMY_DATABASE_URI='sqlite:///:memory:',
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        TESTING=True,
    )
    db.init_app(application)
    with application.app_context():
        db.create_all()
        yield application
        db.session.remove()
        db.drop_all()


def _isp(name, slug):
    isp = ISP(name=name, company_name=name, email=f'{slug}@example.com',
              slug=slug, api_key=f'key_{slug}')
    db.session.add(isp)
    db.session.flush()
    return isp


def _user(isp, role='admin'):
    user = User(email=f'{role}@{isp.slug}.test', password_hash='x',
                first_name='A', last_name='B', role=role, isp_id=isp.id)
    db.session.add(user)
    db.session.flush()
    return user


def _customer(isp, name, connection_type='pppoe', status=CustomerStatus.ACTIVE):
    customer = Customer(full_name=name, phone='0700000000', package='Basic',
                        connection_type=connection_type, status=status,
                        isp_id=isp.id)
    db.session.add(customer)
    db.session.flush()
    return customer


# --- tenant isolation ------------------------------------------------------

def test_query_only_ever_returns_the_callers_tenant(app):
    """The bug this guards: elsewhere in customers.py the tenant check reads
    `user.role != 'admin' and ...`, which exempts admins. Since self-serve
    signup makes every ISP owner an admin, reusing that pattern here would let
    one tenant wipe another's subscriber list."""
    from routes.customers import _bulk_delete_query

    mine = _isp('Mine', 'mine')
    theirs = _isp('Theirs', 'theirs')
    _customer(mine, 'My One')
    _customer(mine, 'My Two')
    _customer(theirs, 'Their One')
    db.session.commit()

    admin = _user(mine, role='admin')
    names = {c.full_name for c in _bulk_delete_query(admin, {}).all()}

    assert names == {'My One', 'My Two'}
    assert 'Their One' not in names


def test_filters_narrow_within_the_tenant(app):
    from routes.customers import _bulk_delete_query

    isp = _isp('Acme', 'acme')
    _customer(isp, 'Pppoe One', connection_type='pppoe')
    _customer(isp, 'Hotspot One', connection_type='hotspot')
    _customer(isp, 'Suspended', connection_type='pppoe',
              status=CustomerStatus.SUSPENDED)
    db.session.commit()
    user = _user(isp)

    by_type = _bulk_delete_query(user, {'connection_type': 'hotspot'}).all()
    assert [c.full_name for c in by_type] == ['Hotspot One']

    by_status = _bulk_delete_query(user, {'status': 'suspended'}).all()
    assert [c.full_name for c in by_status] == ['Suspended']

    by_search = _bulk_delete_query(user, {'search': 'pppoe'}).all()
    assert [c.full_name for c in by_search] == ['Pppoe One']


def test_no_filters_means_every_subscriber_in_that_tenant(app):
    """"Clean up completely" has to actually mean all of them."""
    from routes.customers import _bulk_delete_query

    isp = _isp('Acme', 'acme')
    for i in range(7):
        _customer(isp, f'Client {i}')
    db.session.commit()

    assert _bulk_delete_query(_user(isp), {}).count() == 7


@pytest.mark.parametrize('filters', [
    {'connection_type': 'ftth'},
    {'connection_type': 'nonsense'},
    {'status': 'deleted'},
])
def test_unknown_filter_values_are_refused(app, filters):
    """An unrecognised filter must raise, never silently widen the set."""
    from routes.customers import _bulk_delete_query

    isp = _isp('Acme', 'acme')
    db.session.commit()
    with pytest.raises(ValueError):
        _bulk_delete_query(_user(isp), filters)


@pytest.mark.parametrize('passthrough', ['all', '', None])
def test_all_and_empty_are_treated_as_no_filter(app, passthrough):
    from routes.customers import _bulk_delete_query

    isp = _isp('Acme', 'acme')
    _customer(isp, 'One', connection_type='pppoe')
    _customer(isp, 'Two', connection_type='hotspot')
    db.session.commit()

    query = _bulk_delete_query(
        _user(isp), {'connection_type': passthrough, 'status': passthrough},
    )
    assert query.count() == 2


# --- endpoint guards -------------------------------------------------------

def test_endpoint_requires_admin_and_a_tenant():
    """Read the guards off the source: a support user or an account with no
    isp_id must not be able to mass-delete."""
    import pathlib
    import re

    source = (pathlib.Path(__file__).resolve().parents[1]
              / 'routes' / 'customers.py').read_text()
    body = source.split('def bulk_delete_customers')[1].split('\n@customers_bp')[0]

    assert re.search(r"user\.role\s*!=\s*'admin'", body), 'missing admin gate'
    # The tenant boundary must be resolved before any query is built. Compare
    # against the assignment, not the bare word — it appears in the docstring.
    assert '_resolve_bulk_delete_isp_id' in body, 'missing tenant resolution'
    assert body.index('_resolve_bulk_delete_isp_id') < body.index('scope = (data.get'), (
        'tenant must be resolved before the scope is read'
    )
    assert 'expected_count' in body, 'missing count confirmation'
    # The delete path must drop RADIUS access, or deleted subscribers keep
    # authenticating against live credentials.
    assert 'deprovision_customer_radius' in body, 'missing RADIUS cleanup'


def test_bulk_delete_never_uses_the_admin_bypass_pattern():
    """`role != 'admin' and isp_id != ...` is the legacy single-tenant check.
    It must not appear in the bulk path."""
    import pathlib

    source = (pathlib.Path(__file__).resolve().parents[1]
              / 'routes' / 'customers.py').read_text()
    for fn in ('_bulk_delete_query', 'bulk_delete_customers'):
        body = source.split(f'def {fn}')[1].split('\n@customers_bp')[0]
        assert "role != 'admin' and" not in body, (
            f'{fn} uses the admin-bypass tenant check'
        )


# --- tenant resolution for legacy accounts ---------------------------------
# Every account seeded before multi-tenancy has isp_id NULL, including the
# production admin. Refusing those outright would make this feature unusable on
# exactly the installs that need it; guessing between tenants would be worse.

def test_legacy_admin_resolves_when_there_is_only_one_isp(app):
    from routes.customers import _resolve_bulk_delete_isp_id

    isp = _isp('Only', 'only')
    db.session.commit()
    legacy = User(email='legacy@test', password_hash='x', first_name='A',
                  last_name='B', role='admin', isp_id=None)
    db.session.add(legacy)
    db.session.commit()

    assert _resolve_bulk_delete_isp_id(legacy) == isp.id


def test_legacy_admin_is_refused_when_several_isps_exist(app):
    """Picking "the first active ISP" is fine for a read and unforgivable for
    a delete."""
    from routes.customers import AmbiguousTenant, _resolve_bulk_delete_isp_id

    _isp('One', 'one')
    _isp('Two', 'two')
    db.session.commit()
    legacy = User(email='legacy@test', password_hash='x', first_name='A',
                  last_name='B', role='admin', isp_id=None)
    db.session.add(legacy)
    db.session.commit()

    with pytest.raises(AmbiguousTenant):
        _resolve_bulk_delete_isp_id(legacy)


def test_explicit_isp_id_disambiguates(app):
    from routes.customers import _resolve_bulk_delete_isp_id

    _isp('One', 'one')
    second = _isp('Two', 'two')
    db.session.commit()
    legacy = User(email='legacy@test', password_hash='x', first_name='A',
                  last_name='B', role='admin', isp_id=None)
    db.session.add(legacy)
    db.session.commit()

    assert _resolve_bulk_delete_isp_id(legacy, second.id) == second.id


def test_a_users_own_isp_always_wins_over_a_requested_one(app):
    """A tenant admin must not be able to aim this at someone else by passing
    an isp_id in the body."""
    from routes.customers import _resolve_bulk_delete_isp_id

    mine = _isp('Mine', 'mine')
    theirs = _isp('Theirs', 'theirs')
    db.session.commit()
    admin = _user(mine, role='admin')

    assert _resolve_bulk_delete_isp_id(admin, theirs.id) == mine.id


def test_unknown_explicit_isp_is_refused(app):
    from routes.customers import AmbiguousTenant, _resolve_bulk_delete_isp_id

    _isp('One', 'one')
    _isp('Two', 'two')
    db.session.commit()
    legacy = User(email='legacy@test', password_hash='x', first_name='A',
                  last_name='B', role='admin', isp_id=None)
    db.session.add(legacy)
    db.session.commit()

    with pytest.raises(AmbiguousTenant):
        _resolve_bulk_delete_isp_id(legacy, 9999)
