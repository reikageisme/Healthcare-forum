import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';

const DRIZZLE_DIR = () => join(process.cwd(), 'drizzle');

async function applyFile(name: string): Promise<void> {
  const text = readFileSync(join(DRIZZLE_DIR(), name), 'utf8');
  for (const statement of text.split('--> statement-breakpoint').map((s) => s.trim())) {
    if (statement) await db.execute(sql.raw(statement));
  }
}

/**
 * Baseline-aware bootstrap.
 *
 * The database this ships onto was built by two Alembic migrations and holds
 * live data, so the base schema must never be created a second time — a
 * generated migration run against it would drop and recreate every table.
 * The rule is simply: if the schema is already there, leave it alone.
 *
 * Everything after 0000 is a patch written to be idempotent (IF NOT EXISTS,
 * guarded DO blocks), so the same files run safely on a fresh database and on
 * one that has been live since the FastAPI days.
 */
export async function ensureSchema(): Promise<'baselined' | 'created'> {
  const probe = await db.execute(sql`select to_regclass('public.users') as present`);
  const rows = (Array.isArray(probe) ? probe : (probe as { rows?: unknown[] }).rows ?? []) as Array<{
    present: string | null;
  }>;
  const outcome: 'baselined' | 'created' = rows[0]?.present ? 'baselined' : 'created';

  if (outcome === 'created') {
    await applyFile('0000_init.sql');
  }

  const patches = readdirSync(DRIZZLE_DIR())
    .filter((f) => f.endsWith('.sql') && !f.startsWith('0000_'))
    .sort();
  for (const patch of patches) {
    await applyFile(patch);
  }

  return outcome;
}

/**
 * Postgres is on another machine now, so the container can easily come up
 * before the database is reachable. A few retries beat a crash loop.
 */
async function ensureSchemaWithRetry(attempts = 10, delayMs = 3000) {
  for (let i = 1; i <= attempts; i += 1) {
    try {
      return await ensureSchema();
    } catch (err) {
      if (i === attempts) throw err;
      console.warn(
        `Database not reachable (attempt ${i}/${attempts}) — retrying in ${delayMs / 1000}s...`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error('unreachable');
}

if (process.argv[1] && process.argv[1].includes('migrate')) {
  ensureSchemaWithRetry()
    .then((outcome) => {
      console.log(
        outcome === 'created'
          ? 'Schema created from drizzle/0000_init.sql, patches applied.'
          : 'Schema already present (Alembic baseline) — patches applied.',
      );
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
