#!/bin/sh
# Bring the schema up to date and make sure the demo admin exists before serving.
set -e
alembic upgrade head
python -m app.create_admin
exec "$@"
