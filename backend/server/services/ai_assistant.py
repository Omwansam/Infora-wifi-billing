"""The AI assistant behind Settings > AI Assistant.

Two ways to pay for it, resolved per request:

* **internal** — our own key from the environment, metered against the tenant's
  plan allowance. This is what a tenant gets without configuring anything.
* **anthropic** — the tenant's own key from ``integration_settings['ai']``.
  Their key, their bill, no allowance.

Only Anthropic is implemented. The settings panel also lists OpenAI because
operators ask for it, but a provider with no client here is reported as
unavailable rather than silently falling back to a different vendor's model —
being quietly answered by a model you did not choose is worse than an error.

The assistant is given the tenant's own figures as context so its answers are
about *their* network. It is deliberately read-only: it receives a summary, not
database access, and cannot act on the account.
"""
from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)

# Model ids, newest first. Kept here so the settings panel and the client
# cannot disagree about what is selectable.
ANTHROPIC_MODELS = [
    ('claude-opus-5', 'Claude Opus 5 — most capable'),
    ('claude-sonnet-5', 'Claude Sonnet 5 — balanced'),
    ('claude-haiku-4-5', 'Claude Haiku 4.5 — fastest, cheapest'),
]
DEFAULT_MODEL = 'claude-opus-5'

PROVIDERS = {
    'internal': {
        'name': 'Internal AI',
        'host': 'Included with your plan',
        'detail': 'No API key needed — runs on our account against your daily allowance.',
        'implemented': True,
        'needs_key': False,
        'models': ANTHROPIC_MODELS,
    },
    'anthropic': {
        'name': 'Claude (Anthropic)',
        'host': 'anthropic.com',
        'detail': 'Your own key and your own bill; the daily allowance stops applying.',
        'implemented': True,
        'needs_key': True,
        'models': ANTHROPIC_MODELS,
    },
    'openai': {
        'name': 'OpenAI',
        'host': 'openai.com',
        'detail': 'Listed for completeness — no client is implemented for it yet.',
        'implemented': False,
        'needs_key': True,
        'models': [('gpt-4o', 'GPT-4o'), ('gpt-4o-mini', 'GPT-4o mini')],
    },
}

SYSTEM_PROMPT = (
    'You are the assistant inside an ISP billing dashboard. You help the operator '
    'understand their own network and subscribers.\n\n'
    'You are given a snapshot of this operator\'s figures. Answer from it. If the '
    'snapshot does not contain what was asked, say so plainly and name the page '
    'that would — do not guess at a number.\n\n'
    'Be direct and short. These are busy people reading on a phone. Prefer a '
    'sentence over a paragraph and a number over an adjective. You cannot change '
    'anything in the account; if asked to, say what the operator should click.'
)


class AiError(RuntimeError):
    """Anything that stops an answer coming back, in words worth showing."""


class AiNotConfigured(AiError):
    """No usable key for the selected provider."""


def serialize_settings(isp):
    return {
        'enabled': bool(isp.ai_enabled),
        'provider': isp.ai_provider or 'internal',
        'model': isp.ai_model or DEFAULT_MODEL,
        'providers': [
            {'id': pid, **{k: v for k, v in spec.items()}}
            for pid, spec in PROVIDERS.items()
        ],
    }


def resolve(isp):
    """Which provider, model and key this tenant's next question uses.

    Returns ``{'source', 'provider', 'model', 'api_key'}`` or raises
    :class:`AiNotConfigured`.
    """
    provider = (isp.ai_provider or 'internal').strip().lower()
    spec = PROVIDERS.get(provider)
    if spec is None:
        raise AiNotConfigured(f'Unknown AI provider "{provider}".')
    if not spec['implemented']:
        raise AiNotConfigured(
            f"{spec['name']} is not implemented yet — pick Claude or the internal AI.")

    model = (isp.ai_model or DEFAULT_MODEL).strip()
    valid = {m for m, _ in spec['models']}
    if model not in valid:
        model = DEFAULT_MODEL

    if provider == 'internal':
        key = os.environ.get('ANTHROPIC_API_KEY', '').strip()
        if not key:
            raise AiNotConfigured(
                'The internal assistant is not available on this deployment — no '
                'platform key is configured. Add your own Anthropic key instead.')
        return {'source': 'platform', 'provider': 'anthropic', 'model': model, 'api_key': key}

    from services.tenant_integrations import integration_config

    config = integration_config(isp, 'ai', required=('api_key',))
    if not config:
        raise AiNotConfigured('Save your API key before using the assistant.')
    return {'source': 'tenant', 'provider': 'anthropic',
            'model': model, 'api_key': config['api_key']}


def build_context(isp):
    """A small, current snapshot of this operator's network.

    Deliberately a summary rather than query access: the assistant answers
    questions about the account, it does not get to roam the database.
    """
    from extensions import db
    from models import Customer, CustomerStatus, MikrotikDevice, Payment, PaymentStatus
    from datetime import datetime, timedelta

    day_ago = datetime.utcnow() - timedelta(days=1)
    week_ago = datetime.utcnow() - timedelta(days=7)

    def count(query):
        return int(query.scalar() or 0)

    active = count(db.session.query(db.func.count(Customer.id))
                   .filter(Customer.isp_id == isp.id,
                           Customer.status == CustomerStatus.ACTIVE))
    total = count(db.session.query(db.func.count(Customer.id))
                  .filter(Customer.isp_id == isp.id))
    expired = count(db.session.query(db.func.count(Customer.id))
                    .filter(Customer.isp_id == isp.id,
                            Customer.subscription_end.isnot(None),
                            Customer.subscription_end < datetime.utcnow()))
    today = (db.session.query(db.func.coalesce(db.func.sum(Payment.amount), 0))
             .join(Customer, Payment.customer_id == Customer.id)
             .filter(Customer.isp_id == isp.id,
                     Payment.payment_status == PaymentStatus.COMPLETED,
                     Payment.payment_date >= day_ago).scalar()) or 0
    week = (db.session.query(db.func.coalesce(db.func.sum(Payment.amount), 0))
            .join(Customer, Payment.customer_id == Customer.id)
            .filter(Customer.isp_id == isp.id,
                    Payment.payment_status == PaymentStatus.COMPLETED,
                    Payment.payment_date >= week_ago).scalar()) or 0
    routers = count(db.session.query(db.func.count(MikrotikDevice.id))
                    .filter(MikrotikDevice.isp_id == isp.id))

    cur = isp.currency or 'KES'
    return (
        f"Operator: {isp.name or isp.company_name}\n"
        f"Subscribers: {total} total, {active} active, {expired} past expiry\n"
        f"Collected last 24h: {cur} {today}\n"
        f"Collected last 7d: {cur} {week}\n"
        f"Routers registered: {routers}\n"
    )


def ask(isp, question, history=None):
    """Answer one question. Returns ``{'answer', 'model', 'source'}``."""
    question = (question or '').strip()
    if not question:
        raise AiError('Ask a question first.')
    if not isp.ai_enabled:
        raise AiNotConfigured('The assistant is switched off in Settings.')

    resolved = resolve(isp)

    try:
        import anthropic
    except ImportError as exc:  # pragma: no cover - dependency guard
        raise AiError(
            'The anthropic package is not installed on this deployment.') from exc

    client = anthropic.Anthropic(api_key=resolved['api_key'])
    messages = list(history or [])[-10:]
    messages.append({'role': 'user', 'content': question})

    try:
        response = client.messages.create(
            model=resolved['model'],
            max_tokens=16000,
            system=f'{SYSTEM_PROMPT}\n\nCurrent snapshot:\n{build_context(isp)}',
            messages=messages,
        )
    except anthropic.AuthenticationError as exc:
        raise AiNotConfigured(f'The API key was rejected: {exc}') from exc
    except anthropic.RateLimitError as exc:
        raise AiError(f'Rate limited — try again shortly. ({exc})') from exc
    except anthropic.APIStatusError as exc:
        raise AiError(f'{type(exc).__name__}: {exc}') from exc
    except anthropic.APIConnectionError as exc:
        raise AiError(f'Could not reach the provider: {exc}') from exc

    # Refusals come back as a normal 200; check before reading content.
    if getattr(response, 'stop_reason', None) == 'refusal':
        raise AiError('The model declined to answer that one.')

    answer = '\n'.join(
        block.text for block in response.content if getattr(block, 'type', '') == 'text'
    ).strip()
    return {'answer': answer or '(no answer)', 'model': resolved['model'],
            'source': resolved['source']}
