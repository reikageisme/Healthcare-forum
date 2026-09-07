import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';

const EXPECTED_ENUMS: Record<string, string[]> = {
  userrole: ['guest', 'user', 'doctor', 'moderator', 'admin'],
  posttype: ['article', 'question', 'review', 'share'],
  poststatus: ['pending', 'approved', 'rejected'],
  reactiontype: ['helpful', 'like', 'informative'],
  reportstatus: ['open', 'resolved', 'dismissed'],
  reporttargettype: ['post', 'comment', 'user', 'story'],
  verificationstatus: ['pending', 'approved', 'rejected'],
};

async function main() {
  const result = await db.execute(sql`
    select t.typname,
           array_agg(e.enumlabel order by e.enumsortorder) as labels
      from pg_type t
      join pg_enum e on e.enumtypid = t.oid
     where t.typname in (
       'userrole', 'posttype', 'poststatus', 'reactiontype',
       'reportstatus', 'reporttargettype', 'verificationstatus'
     )
     group by t.typname
     order by t.typname
  `);
  const rows = (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as Array<{
    typname: string;
    labels: string[];
  }>;

  const actual = new Map(rows.map((row) => [row.typname, row.labels]));
  for (const [name, expected] of Object.entries(EXPECTED_ENUMS)) {
    const labels = actual.get(name);
    if (!labels || JSON.stringify(labels) !== JSON.stringify(expected)) {
      throw new Error('Postgres enum ' + name + ' mismatch: ' + JSON.stringify(labels));
    }
  }

  // A real Drizzle insert/read/delete proves the live connection and enum
  // binding, not merely that pg_enum is queryable.
  const suffix = randomUUID().replace(/-/g, '');
  const [inserted] = await db.insert(users).values({
    email: `postgres-smoke-${suffix}@example.test`,
    username: `postgres_smoke_${suffix.slice(0, 12)}`,
    hashed_password: 'postgres-smoke-placeholder',
    role: 'doctor',
  }).returning({ id: users.id, role: users.role });
  if (!inserted || inserted.role !== 'doctor') throw new Error('Postgres ORM enum round-trip failed');
  await db.delete(users).where(sql`${users.id} = ${inserted.id}`);

  console.log('Postgres enum labels and Drizzle ORM round-trip verified.');
}

main()
  .then(async () => {
    const client = (db as unknown as { $client?: { end: () => Promise<unknown> } }).$client;
    await client?.end();
  })
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    const client = (db as unknown as { $client?: { end: () => Promise<unknown> } }).$client;
    await client?.end();
    process.exitCode = 1;
  });
