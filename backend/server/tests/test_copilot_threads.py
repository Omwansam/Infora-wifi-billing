"""Pure logic behind copilot conversation storage.

The database-backed behaviour (ownership scoping, the delete cascade, the
thread cap) is exercised against a real Postgres separately. What is here is
the part that decides *what the model is told*, which is worth pinning down in
a fast test because getting it wrong is silent: the assistant simply starts
answering as though it said things it never said.

Run: backend/.venv/bin/python -m pytest backend/server/tests -q
"""
import os
import sys
import types

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services import copilot_threads as ct  # noqa: E402


def msg(role, content, is_error=False):
    return types.SimpleNamespace(role=role, content=content, is_error=is_error)


def thread(*messages):
    return types.SimpleNamespace(messages=list(messages))


# --- titles ----------------------------------------------------------------

def test_title_comes_from_the_question():
    assert ct.title_from('How many subscribers are past expiry?') == \
        'How many subscribers are past expiry?'


def test_title_collapses_whitespace():
    assert ct.title_from('  how   many\n\nsubscribers ') == 'how many subscribers'


def test_title_is_truncated_with_an_ellipsis():
    title = ct.title_from('x' * 400)
    assert len(title) == ct.TITLE_LENGTH
    assert title.endswith('…')


def test_empty_question_still_gets_a_title():
    assert ct.title_from('   ') == 'New chat'


# --- what the model is told ------------------------------------------------

def test_history_is_oldest_first():
    t = thread(msg('user', 'first'), msg('assistant', 'reply'), msg('user', 'second'))
    assert [m['content'] for m in ct.history_for_model(t)] == ['first', 'reply', 'second']


def test_errors_are_never_replayed():
    """Our error text is a UI artefact, not something the assistant said."""
    t = thread(
        msg('user', 'first'),
        msg('assistant', 'AiError: provider exploded', is_error=True),
        msg('user', 'second'),
    )
    contents = [m['content'] for m in ct.history_for_model(t)]
    assert contents == ['first', 'second']
    assert not any('exploded' in c for c in contents)


def test_history_is_capped_to_the_most_recent_turns():
    t = thread(*[msg('user', f'q{i}') for i in range(ct.HISTORY_TURNS + 10)])
    history = ct.history_for_model(t)
    assert len(history) == ct.HISTORY_TURNS
    # The cap must drop the *oldest*, keeping the turns nearest the question.
    assert history[-1]['content'] == f'q{ct.HISTORY_TURNS + 9}'


def test_history_carries_only_role_and_content():
    """Anything else would be sent to the provider as part of the transcript."""
    t = thread(msg('user', 'hello'))
    assert set(ct.history_for_model(t)[0]) == {'role', 'content'}
