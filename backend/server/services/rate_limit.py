"""Lightweight in-process rate limiting (no external dependency).

Provides:
  - ``is_rate_limited(bucket, limit, window)`` — low-level check (used where a
    custom response is needed, e.g. the provisioning route returns 404).
  - ``rate_limit(limit, window, ...)`` — decorator that returns HTTP 429.

Notes / limitations:
  - State is per-process. Under multi-worker gunicorn each worker keeps its own
    counters, so the effective limit is roughly ``limit * num_workers``. That is
    acceptable as a first line of defence against brute force / scraping; for
    strict global limits move the backing store to Redis (e.g. flask-limiter).
"""
import time
from collections import defaultdict
from functools import wraps
from threading import Lock

from flask import jsonify, request

_hits = defaultdict(list)
_lock = Lock()
_last_sweep = 0.0
_SWEEP_INTERVAL = 300  # seconds
_SWEEP_MAX_AGE = 3600  # drop buckets idle longer than this


def client_ip():
    """Best-effort client IP, honouring the proxy's X-Forwarded-For."""
    forwarded = request.headers.get('X-Forwarded-For')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.remote_addr or 'unknown'


def _sweep(now):
    """Bound memory by dropping buckets with no recent hits."""
    global _last_sweep
    if now - _last_sweep < _SWEEP_INTERVAL:
        return
    _last_sweep = now
    for key in list(_hits.keys()):
        recent = [t for t in _hits[key] if now - t < _SWEEP_MAX_AGE]
        if recent:
            _hits[key] = recent
        else:
            _hits.pop(key, None)


def is_rate_limited(bucket, limit, window):
    """Record a hit for ``bucket`` and return True if it exceeds ``limit``/``window``."""
    now = time.time()
    with _lock:
        _sweep(now)
        hits = [t for t in _hits[bucket] if now - t < window]
        hits.append(now)
        _hits[bucket] = hits
        return len(hits) > limit


def rate_limit(limit, window, scope=None, extra_key=None):
    """Decorator: limit a view to ``limit`` requests per ``window`` seconds per IP.

    Args:
        limit: max requests allowed in the window.
        window: window length in seconds.
        scope: bucket namespace (defaults to the view function name).
        extra_key: optional callable returning a string to further segment the
            bucket (e.g. an email or token from the request body).
    """
    def decorator(view):
        namespace = scope or view.__name__

        @wraps(view)
        def wrapper(*args, **kwargs):
            parts = [namespace, client_ip()]
            if extra_key is not None:
                try:
                    extra = extra_key()
                    if extra:
                        parts.append(str(extra))
                except Exception:
                    pass
            bucket = '|'.join(parts)
            if is_rate_limited(bucket, limit, window):
                response = jsonify({
                    'error': 'Too many requests. Please slow down and try again shortly.'
                })
                response.status_code = 429
                response.headers['Retry-After'] = str(int(window))
                return response
            return view(*args, **kwargs)

        return wrapper

    return decorator
