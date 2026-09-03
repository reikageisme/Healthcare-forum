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

  it('round-trips every application enum value through Drizzle', async () => {
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
  });

  it('repairs known uppercase SQLAlchemy labels before application writes', async () => {
    const suffix = randomUUID();
    const author = await db
      .insert(users)
      .values({
        email: `legacy-${suffix}@test.vn`,
        username: `legacy_${suffix.slice(0, 8)}`,
        hashed_password: 'test-only-hash',
        role: 'doctor',
      })
      .returning({ id: users.id });

    await db
      .insert(posts)
      .values({
        title: 'Legacy enum row',
        slug: `legacy-${suffix}`,
        content: '<p>legacy enum row</p>',
        author_id: author[0]!.id,
        post_type: 'article',
      })
      .returning({ id: posts.id });

    for (const [type, from, to] of [
      ['posttype', 'article', 'ARTICLE'],
      ['posttype', 'question', 'QUESTION'],
      ['posttype', 'review', 'REVIEW'],
      ['posttype', 'share', 'SHARE'],
      ['reactiontype', 'helpful', 'HELPFUL'],
      ['reactiontype', 'like', 'LIKE'],
      ['reactiontype', 'informative', 'INFORMATIVE'],
    ] as const) {
      await db.execute(
        sql.raw(`ALTER TYPE "public"."${type}" RENAME VALUE '${from}' TO '${to}'`),
      );
    }

    await expect(ensureSchema()).resolves.toBe('baselined');
    await expect(enumLabels('posttype')).resolves.toEqual([
      'article',
      'question',
      'review',
      'share',
    ]);
    await expect(enumLabels('reactiontype')).resolves.toEqual([
      'helpful',
      'like',
      'informative',
    ]);

    const repaired = await db
      .insert(posts)
      .values({
        title: 'Post after enum repair',
        slug: `repaired-${suffix}`,
        content: '<p>lowercase writes work</p>',
        author_id: author[0]!.id,
        post_type: 'question',
        status: 'pending',
      })
      .returning({ post_type: posts.post_type, status: posts.status });
    expect(repaired[0]).toMatchObject({ post_type: 'question', status: 'pending' });
  });

  it('fails diagnostically when legacy and canonical labels coexist', async () => {
    await db.execute(sql.raw('ALTER TYPE "public"."posttype" ADD VALUE \'ARTICLE\''));

    await expect(ensureSchema()).rejects.toThrow(
      /Enum public\.posttype contains both legacy value "ARTICLE" and canonical value "article"/,
    );
  });
});
