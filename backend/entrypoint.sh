#!/bin/sh
# Create the schema only if this is a brand-new database, clean any content
# stored before sanitising existed, then make sure an admin exists.
set -e

run() {
  if [ -f "dist/scripts/$1.js" ]; then
    node "dist/scripts/$1.js"
  else
    npx tsx "src/scripts/$1.ts"
  fi
}

run migrate
run sanitizeExisting
run createAdmin

exec "$@"
