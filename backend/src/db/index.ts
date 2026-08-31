import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { settings } from '../core/config.js';
import * as schema from './schema.js';

export type Database = ReturnType<typeof drizzle<typeof schema>>;

function createPostgresDb(): Database {
  // postgres-js connects lazily, so building this is cheap even when the
  // test suite is about to swap it out.
  const client = postgres(settings.DATABASE_URL, { max: 10 });
  return drizzle(client, { schema, logger: settings.SQL_ECHO });
}

/**
 * A live binding rather than a const: the test harness swaps in PGlite —
 * real Postgres compiled to WebAssembly, in memory, no container — and every
 * module that imported `db` sees the replacement.
 *
 * The Python suite ran on SQLite (conftest.py:22), so enum labels, uuid
 * columns and timestamptz were never exercised by a test. That is the exact
 * class of bug enum_column() in database.py exists to work around.
 */
export let db: Database = createPostgresDb();

export function setDatabase(next: Database): void {
  db = next;
}

export { schema };
