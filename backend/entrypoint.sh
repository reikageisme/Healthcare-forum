#!/bin/sh
# Bring the database up to a usable state before serving. Every step is
# idempotent, so this runs safely on every boot:
#   1. create the database itself if the server does not have it yet
#   2. create the schema (only on a brand-new database) and apply patches
#   3. clean any content stored before sanitising existed
#   4. create the first admin account when ADMIN_PASSWORD is set
set -e

run() {
  if [ -f "dist/scripts/$1.js" ]; then
    node "dist/scripts/$1.js"
  else
    npx tsx "src/scripts/$1.ts"
  fi
}

run createDatabase
run migrate
run sanitizeExisting
run createAdmin

exec "$@"
