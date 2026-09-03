import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/index.js';
import {
  doctorVerifications,
  posts,
  reactions,
  reports,
  users,
} from '../src/db/schema.js';
import { ensureSchema } from '../src/scripts/migrate.js';
import { closeDatabase, freshDatabase } from './setup.js';

type SqlRow = Record<string, unknown>;

function resultRows(result: unknown): SqlRow[] {
  return (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as SqlRow[];
}

async function enumLabels(enumName: string): Promise<string[]> {
  const result = await db.execute(sql`
    select e.enumlabel
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
     where t.typnamespace = 'public'::regnamespace
       and t.typname = ${enumName}
     order by e.enumsortorder
  `);
  return resultRows(result).map((row) => String(row.enumlabel));
}

beforeEach(async () => {
  await freshDatabase();
});

afterEach(async () => {
  await closeDatabase();
});

describe('database enum lineage', () => {
  it('keeps the canonical lowercase labels across repeated bootstrap runs', async () => {
    const canonical = {
      userrole: ['guest', 'user', 'doctor', 'moderator', 'admin'],
      posttype: ['article', 'question', 'review', 'share'],
      poststatus: ['pending', 'approved', 'rejected'],
      reactiontype: ['helpful', 'like', 'informative'],
      reportstatus: ['open', 'resolved', 'dismissed'],
      reporttargettype: ['post', 'comment', 'user', 'story'],
      verificationstatus: ['pending', 'approved', 'rejected'],
    } as const;

    for (const [name, labels] of Object.entries(canonical)) {
      await expect(enumLabels(name)).resolves.toEqual(labels);
    }

    await expect(ensureSchema()).resolves.toBe('baselined');
    await expect(ensureSchema()).resolves.toBe('baselined');

    for (const [name, labels] of Object.entries(canonical)) {
      await expect(enumLabels(name)).resolves.toEqual(labels);
    }
  });

  it('round-trips every application enum value and preserves rows across bootstrap', async () => {
    const suffix = randomUUID();
    const roleValues = ['guest', 'user', 'doctor', 'moderator', 'admin'] as const;
    const postTypeValues = ['article', 'question', 'review', 'share'] as const;
    const postStatusValues = ['pending', 'approved', 'rejected'] as const;
    const reactionTypeValues = ['helpful', 'like', 'informative'] as const;
    const reportStatusValues = ['open', 'resolved', 'dismissed'] as const;
    const reportTargetValues = ['post', 'comment', 'user', 'story'] as const;
    const verificationStatusValues = ['pending', 'approved', 'rejected'] as const;

    const enumUsers = await db
      .insert(users)
      .values(
        roleValues.map((role) => ({
          email: `enum-${role}-${suffix}@test.vn`,
          username: `enum_${role}_${suffix.slice(0, 8)}`,
          hashed_password: 'test-only-hash',
          role,
        })),
      )
      .returning({ id: users.id, role: users.role });
    expect(enumUsers.map((row) => row.role)).toEqual(roleValues);

    const enumPosts = await db
      .insert(posts)
      .values(
        postTypeValues.flatMap((postType, typeIndex) =>
          postStatusValues.map((status, statusIndex) => ({
            title: `Enum ${postType} ${status}`,
            slug: `enum-${postType}-${status}-${suffix}-${typeIndex}-${statusIndex}`,
            content: '<p>enum roundtrip</p>',
            post_type: postType,
            status,
            author_id: enumUsers[1]!.id,
          })),
        ),
      )
      .returning({ id: posts.id, post_type: posts.post_type, status: posts.status });
    expect(new Set(enumPosts.map((row) => row.post_type))).toEqual(new Set(postTypeValues));
    expect(new Set(enumPosts.map((row) => row.status))).toEqual(new Set(postStatusValues));

    const enumReactions = await db
      .insert(reactions)
      .values(
        reactionTypeValues.map((reaction_type, index) => ({
          user_id: enumUsers[index + 1]!.id,
          post_id: enumPosts[0]!.id,
          reaction_type,
        })),
      )
      .returning({ reaction_type: reactions.reaction_type });
    expect(enumReactions.map((row) => row.reaction_type)).toEqual(reactionTypeValues);

    const enumReports = await db
      .insert(reports)
      .values(
        reportStatusValues.flatMap((status) =>
          reportTargetValues.map((target_type) => ({
            reporter_id: enumUsers[1]!.id,
            target_type,
            target_id: enumPosts[0]!.id,
            reason: `enum ${target_type}`,
            status,
          })),
        ),
      )
      .returning({ target_type: reports.target_type, status: reports.status });
    expect(new Set(enumReports.map((row) => row.target_type))).toEqual(new Set(reportTargetValues));
    expect(new Set(enumReports.map((row) => row.status))).toEqual(new Set(reportStatusValues));

    const enumVerifications = await db
      .insert(doctorVerifications)
      .values(
        verificationStatusValues.map((status, index) => ({
          user_id: enumUsers[1]!.id,
          full_name: 'Enum Test',
          license_number: `ENUM-${suffix}-${index}`,
          document_url: `/uploads/enum-${index}.jpg`,
          status,
        })),
      )
      .returning({ status: doctorVerifications.status });
    expect(enumVerifications.map((row) => row.status)).toEqual(verificationStatusValues);

    // The observed deployment is already canonical. Reapplying the normal
    // patches must preserve populated rows, including IDs and timestamps.
    const snapshot = () => Promise.all([
      db.select().from(users).orderBy(users.id),
      db.select().from(posts).orderBy(posts.id),
      db.select().from(reactions).orderBy(reactions.id),
      db.select().from(reports).orderBy(reports.id),
      db.select().from(doctorVerifications).orderBy(doctorVerifications.id),
    ]);
    const before = await snapshot();
    for (let run = 0; run < 2; run += 1) {
      await expect(ensureSchema()).resolves.toBe('baselined');
      expect(await snapshot()).toEqual(before);
    }
  });

  it('keeps lowercase defaults usable after repeated bootstrap', async () => {
    const defaultsQuery = sql`
      select table_name, column_name, column_default
        from information_schema.columns
       where table_schema = 'public'
         and udt_name in (
           'userrole', 'posttype', 'poststatus', 'reactiontype',
           'reportstatus', 'reporttargettype', 'verificationstatus'
         )
       order by table_name, column_name
    `;
    const before = resultRows(await db.execute(defaultsQuery));
    expect(before).toHaveLength(7);
    await expect(ensureSchema()).resolves.toBe('baselined');
    await expect(ensureSchema()).resolves.toBe('baselined');
    expect(resultRows(await db.execute(defaultsQuery))).toEqual(before);

    const suffix = randomUUID();
    const author = await db
      .insert(users)
      .values({
        email: `defaults-${suffix}@test.vn`,
        username: `defaults_${suffix.slice(0, 8)}`,
        hashed_password: 'test-only-hash',
      })
      .returning({ id: users.id, role: users.role });
    expect(author[0]!.role).toBe('user');

    const insertedPost = await db
      .insert(posts)
      .values({
        title: 'Canonical defaults',
        slug: `defaults-${suffix}`,
        content: '<p>default enum values</p>',
        author_id: author[0]!.id,
      })
      .returning({ id: posts.id, post_type: posts.post_type, status: posts.status });
    expect(insertedPost[0]).toMatchObject({ post_type: 'article', status: 'approved' });

    const insertedReport = await db
      .insert(reports)
      .values({
        reporter_id: author[0]!.id,
        target_type: 'post',
        target_id: insertedPost[0]!.id,
        reason: 'Default status check',
      })
      .returning({ status: reports.status });
    expect(insertedReport[0]!.status).toBe('open');

    const insertedVerification = await db
      .insert(doctorVerifications)
      .values({
        user_id: author[0]!.id,
        full_name: 'Default Test',
        license_number: `DEFAULT-${suffix}`,
        document_url: '/uploads/default.jpg',
      })
      .returning({ status: doctorVerifications.status });
    expect(insertedVerification[0]!.status).toBe('pending');
  });
});
