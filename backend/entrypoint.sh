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

# In production /app/uploads is bind-mounted from the host, so it arrives
# owned by the host user and the image's build-time chown no longer applies —
# the server could not write a single file there, which is what turned every
# image upload into a 500. Fix the ownership while still root, then drop to
# the unprivileged user to serve. The dev image has no `app` user and stays
# as it is.
if [ "$(id -u)" = "0" ] && id -u app >/dev/null 2>&1; then
  mkdir -p "${UPLOAD_DIR:-uploads}"
  chown -R app:app "${UPLOAD_DIR:-uploads}"
  # If su-exec is missing (an image built before it was added), serving as
  # root is worse than serving nothing — but the chown above has already
  # fixed the upload directory, so fall through rather than fail to boot.
  if command -v su-exec >/dev/null 2>&1; then
    exec su-exec app "$@"
  fi
fi

exec "$@"
