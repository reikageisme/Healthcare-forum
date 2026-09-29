-- Server-side session generation. Logging out increments this number; every
-- JWT carries the value it was issued with, so tokens still open in another
-- tab or subdomain are rejected immediately.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 0;
