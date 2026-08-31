import postgres from 'postgres';
import { settings } from '../core/config.js';

/**
 * Creates the application database if it is not there yet.
 *
 * Without this the very first boot cannot work: every other script connects
 * straight to `healthcare_forum`, and Postgres refuses the connection outright
 * when that database does not exist — so `migrate` never gets the chance to
 * create any tables. Postgres has no "CREATE DATABASE IF NOT EXISTS", so the
 * check runs against the `postgres` maintenance database first.
 *
 * Safe to run on every boot: if the database is already there it does nothing.
 */

/** Only a plain identifier is ever interpolated into CREATE DATABASE. */
const SAFE_NAME = /^[A-Za-z_][A-Za-z0-9_$]*$/;

export interface DatabaseTarget {
  dbName: string;
  /** Same server and credentials, pointed at the maintenance database. */
  adminUrl: string;
  username: string;
  host: string;
}

export function parseDatabaseTarget(databaseUrl: string): DatabaseTarget {
  const url = new URL(databaseUrl);
  const dbName = decodeURIComponent(url.pathname.replace(/^\//, ''));

  if (!dbName) {
    throw new Error('DATABASE_URL has no database name at the end of the path.');
  }
  if (!SAFE_NAME.test(dbName)) {
    throw new Error(
      `Refusing to create a database named "${dbName}" — use letters, digits and underscores only.`,
    );
  }

  const adminUrl = new URL(url.toString());
  adminUrl.pathname = '/postgres';

  return {
    dbName,
    adminUrl: adminUrl.toString(),
    username: url.username,
    host: url.host,
  };
}

export async function ensureDatabase(): Promise<'exists' | 'created'> {
  const { dbName, adminUrl, username } = parseDatabaseTarget(settings.DATABASE_URL);

  const admin = postgres(adminUrl, { max: 1, onnotice: () => {} });
  try {
    const existing = await admin`select 1 from pg_database where datname = ${dbName}`;
    if (existing.length > 0) return 'exists';

    // CREATE DATABASE cannot run inside a transaction block.
    await admin.unsafe(`CREATE DATABASE "${dbName}"`);
    return 'created';
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/permission denied|must be superuser|CREATEDB/i.test(message)) {
      throw new Error(
        `The user "${username}" is not allowed to create databases. Either grant it ` +
          `CREATEDB, or create the database once by hand:\n\n` +
          `  psql -h ${new URL(settings.DATABASE_URL).hostname} -U postgres -c 'CREATE DATABASE "${dbName}"'\n`,
      );
    }
    throw err;
  } finally {
    await admin.end({ timeout: 5 });
  }
}

async function ensureDatabaseWithRetry(attempts = 10, delayMs = 3000) {
  for (let i = 1; i <= attempts; i += 1) {
    try {
      return await ensureDatabase();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // A privilege problem will not fix itself by waiting.
      if (/not allowed to create databases|Refusing to create/.test(message)) throw err;
      if (i === attempts) throw err;
      console.warn(
        `Postgres not reachable at ${parseDatabaseTarget(settings.DATABASE_URL).host} ` +
          `(attempt ${i}/${attempts}) — retrying in ${delayMs / 1000}s...`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error('unreachable');
}

if (process.argv[1] && process.argv[1].includes('createDatabase')) {
  ensureDatabaseWithRetry()
    .then((outcome) => {
      const { dbName: name } = parseDatabaseTarget(settings.DATABASE_URL);
      console.log(
        outcome === 'created'
          ? `Database "${name}" created.`
          : `Database "${name}" already exists.`,
      );
      process.exit(0);
    })
    .catch((err) => {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
