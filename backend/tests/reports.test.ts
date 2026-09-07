import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { db } from '../src/db/index.js';
import { comments, posts, reports, users } from '../src/db/schema.js';
import { closeDatabase, freshDatabase, json, request, seedUser, type SeededUser } from './setup.js';

let admin: SeededUser;
let moderator: SeededUser;
let owner: SeededUser;
let reporterA: SeededUser;
let reporterB: SeededUser;

async function makePost(title = 'Reported post') {
  const [post] = await db.insert(posts).values({
    title: title + ' ' + randomUUID(),
    slug: 'reported-' + randomUUID(),
    content: '<p>Reported content.</p>',
    author_id: owner.id,
    status: 'approved',
    is_published: true,
  }).returning();
  return post!;
}

async function makeReport(
  reporter: SeededUser,
  targetType: 'post' | 'comment' | 'user',
  targetId: string,
) {
  const response = await request('/reports', {
    method: 'POST',
    token: reporter.token,
    body: json({ target_type: targetType, target_id: targetId, reason: 'Spam content' }),
  });
  expect(response.status).toBe(201);
  return response.json() as Promise<{ id: string; target_id: string }>;
}

async function removeReportedContent(reportId: string, token: string) {
  return request('/admin/reports/' + reportId + '/content', {
    method: 'DELETE',
    token,
  });
}

beforeAll(async () => {
  await freshDatabase();
  admin = await seedUser('admin');
  moderator = await seedUser('moderator');
  owner = await seedUser('user');
  reporterA = await seedUser('user');
  reporterB = await seedUser('user');
});

afterAll(closeDatabase);

describe('G7 atomic report content action', () => {
  it('REP-01/02/06 removes a post and resolves every open report for that target', async () => {
    const post = await makePost();
    const first = await makeReport(reporterA, 'post', post.id);
    const second = await makeReport(reporterB, 'post', post.id);
    const otherPost = await makePost('Other reported post');
    const other = await makeReport(reporterA, 'post', otherPost.id);

    const response = await removeReportedContent(first.id, moderator.token);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ target_id: post.id, target_exists: true });

    const [stored] = await db.select().from(posts).where(eq(posts.id, post.id));
    expect(stored).toMatchObject({ status: 'rejected', is_published: false });
    const sameTarget = await db.select().from(reports).where(eq(reports.target_id, post.id));
    expect(sameTarget).toHaveLength(2);
    expect(sameTarget.every((report) => report.status === 'resolved')).toBe(true);
    expect(sameTarget.every((report) => report.resolved_by === moderator.id)).toBe(true);
    expect((await db.select().from(reports).where(eq(reports.id, other.id)))[0]!.status).toBe('open');
    expect(second.target_id).toBe(post.id);
    expect(admin.id).not.toBe(moderator.id);
  });

  it('REP-03 removes a comment and resolves its reports in the same action', async () => {
    const post = await makePost('Reported comment post');
    const [comment] = await db.insert(comments).values({
      post_id: post.id,
      author_id: owner.id,
      content: '<p>Reported comment.</p>',
    }).returning();
    const report = await makeReport(reporterA, 'comment', comment!.id);

    const response = await removeReportedContent(report.id, admin.token);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ deleted_type: 'comment', target_exists: true });
    const [stored] = await db.select().from(comments).where(eq(comments.id, comment!.id));
    expect(stored).toMatchObject({
      is_deleted: true,
      content: '[Nội dung đã bị xóa do vi phạm tiêu chuẩn cộng đồng]',
    });
    expect((await db.select().from(reports).where(eq(reports.id, report.id)))[0]!.status).toBe('resolved');
  });

  it('REP-04 deactivates a user target and resolves its report', async () => {
    const target = await seedUser('user');
    const report = await makeReport(reporterA, 'user', target.id);

    const response = await removeReportedContent(report.id, moderator.token);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ deleted_type: 'user', target_exists: true });
    expect((await db.select({ is_active: users.is_active }).from(users).where(eq(users.id, target.id)))[0]!.is_active).toBe(false);
    expect((await db.select().from(reports).where(eq(reports.id, report.id)))[0]!.status).toBe('resolved');
  });

  it('REP-05 closes an already absent target idempotently and blocks closed reports', async () => {
    const post = await makePost('Already absent post');
    const report = await makeReport(reporterA, 'post', post.id);
    await db.delete(posts).where(eq(posts.id, post.id));

    const first = await removeReportedContent(report.id, admin.token);
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ target_exists: false, target_id: post.id });

    const second = await removeReportedContent(report.id, admin.token);
    expect(second.status).toBe(409);
    expect(await second.json()).toEqual({ detail: 'Report is already closed' });
  });

  it('preserves moderator/admin RBAC and does not mutate on an unauthorized action', async () => {
    const target = await makePost('Unauthorized report target');
    const report = await makeReport(reporterA, 'post', target.id);
    const response = await removeReportedContent(report.id, owner.token);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ detail: 'Not enough permissions' });
    expect((await db.select().from(posts).where(eq(posts.id, target.id)))[0]!.status).toBe('approved');
    expect((await db.select().from(reports).where(eq(reports.id, report.id)))[0]!.status).toBe('open');
  });

  it('returns a missing-report error without mutating unrelated content', async () => {
    const target = await makePost('Missing report target');
    const response = await removeReportedContent(randomUUID(), admin.token);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ detail: 'Report not found' });
    expect((await db.select().from(posts).where(eq(posts.id, target.id)))[0]!.status).toBe('approved');
  });

  it('does not resolve an unrelated open report when the target action succeeds', async () => {
    const post = await makePost('Open report remains');
    const unrelatedTarget = await makePost('Unrelated target');
    const first = await makeReport(reporterA, 'post', post.id);
    const unrelated = await makeReport(reporterB, 'post', unrelatedTarget.id);
    await removeReportedContent(first.id, admin.token);
    const rows = await db.select({ status: reports.status }).from(reports).where(and(
      eq(reports.id, unrelated.id), eq(reports.target_id, unrelatedTarget.id),
    ));
    expect(rows[0]!.status).toBe('open');
  });
});
