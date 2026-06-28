#!/bin/sh
set -e
export PYTHONPATH=/app/server:/app
cd /app/server
python -m flask db upgrade
python -m flask initdb
cd /app
exec gunicorn --bind 0.0.0.0:5000 --workers 4 --threads 2 --timeout 120 --chdir /app/server app:app
