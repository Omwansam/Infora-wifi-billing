"""Server-side storage for copilot conversations.

Threads were briefly kept in the browser. They are here now, which buys three
things the browser could not:

* history follows the operator to another machine,
* the conversation sent to the model is **derived from the database**, not
  taken from the client — a browser can no longer replay, reorder or invent
  turns the assistant then treats as its own words,
* and a failed answer is part of the transcript rather than something that
  vanishes on reload.

Two caps keep this from growing without bound. Both trim silently, because a
chat panel is not a place to surface a quota.
"""
from __future__ import annotations

import logging

from extensions import db
from models import CopilotMessage, CopilotThread

logger = logging.getLogger(__name__)

# Turns handed to the model. Matches what the panel renders, so what is on
# screen is what the assistant saw.
HISTORY_TURNS = 20
# Threads kept per operator; the oldest are dropped past this.
MAX_THREADS = 50
TITLE_LENGTH = 120


def title_from(question):
    text = ' '.join((question or '').split())
    if not text:
        return 'New chat'
    return text if len(text) <= TITLE_LENGTH else f'{text[:TITLE_LENGTH - 1]}…'


def list_threads(user):
    return (CopilotThread.query
            .filter_by(user_id=user.id)
            .order_by(CopilotThread.updated_at.desc(), CopilotThread.id.desc())
            .all())


def get_thread(user, thread_id):
    """One thread, or ``None``. Scoped to the owner — never just the id."""
    return CopilotThread.query.filter_by(id=thread_id, user_id=user.id).first()


def serialize_message(row):
    return {
        'id': row.id,
        'role': row.role,
        'content': row.content,
        'meta': row.meta or '',
        'error': bool(row.is_error),
        'created_at': row.created_at.isoformat() if row.created_at else None,
    }


def serialize_thread(row, with_messages=False):
    payload = {
        'id': row.id,
        'title': row.title,
        'updated_at': row.updated_at.isoformat() if row.updated_at else None,
        'message_count': len(row.messages),
    }
    if with_messages:
        payload['messages'] = [serialize_message(m) for m in row.messages]
    return payload


def _prune_threads(user):
    """Drop the oldest threads past the cap. Cascade removes their messages."""
    extra = (CopilotThread.query
             .filter_by(user_id=user.id)
             .order_by(CopilotThread.updated_at.desc(), CopilotThread.id.desc())
             .offset(MAX_THREADS).all())
    for row in extra:
        db.session.delete(row)


def create_thread(isp, user, title=None):
    thread = CopilotThread(isp_id=isp.id, user_id=user.id,
                           title=title or 'New chat')
    db.session.add(thread)
    db.session.flush()
    _prune_threads(user)
    return thread


def add_message(thread, role, content, meta=None, is_error=False):
    row = CopilotMessage(thread_id=thread.id, role=role, content=content,
                         meta=meta, is_error=bool(is_error))
    db.session.add(row)
    return row


def history_for_model(thread):
    """The last N completed turns, oldest first.

    Errors are excluded: an assistant turn that reads "the gateway refused it"
    is a UI artefact, and replaying it would have the model treat our error
    message as something it once said.
    """
    turns = [m for m in thread.messages if not m.is_error]
    return [{'role': m.role, 'content': m.content} for m in turns[-HISTORY_TURNS:]]


def delete_thread(user, thread_id):
    thread = get_thread(user, thread_id)
    if thread is None:
        return False
    db.session.delete(thread)
    db.session.commit()
    return True


def ask_in_thread(isp, user, question, thread_id=None):
    """Ask within a thread, persisting both sides. Creates the thread if needed.

    The user's question is committed **before** the model is called, so a
    failure cannot make it disappear — the operator sees what they asked, and
    the error underneath it.
    """
    from services import ai_assistant

    question = (question or '').strip()
    if not question:
        raise ai_assistant.AiError('Ask a question first.')

    thread = get_thread(user, thread_id) if thread_id else None
    if thread is None:
        thread = create_thread(isp, user, title=title_from(question))
    elif thread.title in (None, '', 'New chat'):
        thread.title = title_from(question)

    history = history_for_model(thread)
    add_message(thread, 'user', question)
    # Touch the thread so it sorts to the top even if the answer fails.
    thread.updated_at = db.func.current_timestamp()
    db.session.commit()

    try:
        result = ai_assistant.ask(isp, question, history=history)
    except ai_assistant.AiError as exc:
        add_message(thread, 'assistant', f'{type(exc).__name__}: {exc}', is_error=True)
        db.session.commit()
        raise

    meta = f"{result['model']} · {'your key' if result['source'] == 'tenant' else 'platform key'}"
    add_message(thread, 'assistant', result['answer'], meta=meta)
    db.session.commit()

    return {
        'thread_id': thread.id,
        'title': thread.title,
        'answer': result['answer'],
        'model': result['model'],
        'source': result['source'],
        'meta': meta,
    }
