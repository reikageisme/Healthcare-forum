import { Hono } from 'hono';
import type { Context } from 'hono';
import { and, asc, count, desc, eq, gte, ilike, inArray, or, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  categories,
  comments,
  doctorVerifications,
  posts,
  reports,
  stories,
  users,
} from '../db/schema.js';
import { badRequest, notFound } from '../core/errors.js';
import { asUuid } from '../core/security.js';
import { parseBody } from '../lib/validate.js';
import { sanitizePlainText } from '../lib/sanitize.js';
import { loadTagsForPosts } from '../lib/postQueries.js';
import { categoryScope } from '../lib/categoryTree.js';
import { toDateKey, toIsoRequired } from '../lib/datetime.js';
import {
  verificationReviewSchema,
  adminUserUpdateSchema,
  postModerationSchema,
  postRejectSchema,
  reportUpdateSchema,
  userRoleUpdateSchema,
  userStatusUpdateSchema,
} from '../schemas/requests.js';
import {
  toPostSummary,
  toReportResponse,
  toUserResponse,
  type PostSummaryResponse,
  type ReportResponse,
} from '../schemas/responses.js';
import {
  currentUser,
  requireAdminOnly,
  requireAdminOrModerator,
  requireAuth,
} from '../middleware/auth.js';

export const adminRoutes = new Hono();

// Everything under /admin needs at least a moderator; the two role-changing
// endpoints tighten that to admin individually.
adminRoutes.use('*', requireAuth, requireAdminOrModerator);

const PAGE = (v: string | undefined) => Math.max(1, Number(v ?? 1) || 1);
const LIMIT = (v: string | undefined, fallback = 20) =>
  Math.min(100, Math.max(1, Number(v ?? fallback) || fallback));

// ---------------------------------------------------------------------------
// 1. Dashboard & analytics
// ---------------------------------------------------------------------------

adminRoutes.get('/stats', async (c) => {
  const daysRaw = Number(c.req.query('days') ?? 30);
  const days = Math.min(90, Math.max(1, Number.isFinite(daysRaw) ? Math.trunc(daysRaw) : 30));

  const [
    totalUsers,
    totalPosts,
    totalComments,
    totalPending,
    totalOpenReports,
    totalCategories,
    totalDoctors,
  ] = await Promise.all([
    db.select({ n: count() }).from(users),
    db.select({ n: count() }).from(posts).where(eq(posts.status, 'approved')),
    db.select({ n: count() }).from(comments).where(eq(comments.is_deleted, false)),
    db.select({ n: count() }).from(posts).where(eq(posts.status, 'pending')),
    db.select({ n: count() }).from(reports).where(eq(reports.status, 'open')),
    db.select({ n: count() }).from(categories),
    db.select({ n: count() }).from(users).where(eq(users.role, 'doctor')),
  ]);

  const overview = {
    total_users: Number(totalUsers[0]?.n ?? 0),
    total_posts: Number(totalPosts[0]?.n ?? 0),
    total_comments: Number(totalComments[0]?.n ?? 0),
    total_pending_posts: Number(totalPending[0]?.n ?? 0),
    total_open_reports: Number(totalOpenReports[0]?.n ?? 0),
    total_categories: Number(totalCategories[0]?.n ?? 0),
    total_doctors: Number(totalDoctors[0]?.n ?? 0),
  };

  // Continuous list of UTC dates, oldest first, then the grouped counts get
  // mapped onto it. Days with no rows have to come back as 0 rather than be
  // missing, or the chart draws a shorter axis than the range asked for.
  const now = new Date();
  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const dateKeys: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    dateKeys.push(toDateKey(new Date(todayUtc.getTime() - i * 86_400_000)));
  }
  const cutoff = new Date(todayUtc.getTime() - (days - 1) * 86_400_000);

  async function dailyCounts(table: 'users' | 'posts' | 'comments') {
    const result = await db.execute(sql`
      select to_char((created_at at time zone 'utc')::date, 'YYYY-MM-DD') as day,
             count(*)::int as n
        from ${sql.raw(table)}
       where created_at >= ${cutoff}
       group by 1
    `);
    const rows = (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as Array<{ day: string; n: number }>;
    const map = new Map<string, number>();
    for (const row of rows) map.set(String(row.day), Number(row.n));
    return map;
  }

  const [userDaily, postDaily, commentDaily] = await Promise.all([
    dailyCounts('users'),
    dailyCounts('posts'),
    dailyCounts('comments'),
  ]);

  const time_series = dateKeys.map((date) => ({
    date,
    new_users: userDaily.get(date) ?? 0,
    new_posts: postDaily.get(date) ?? 0,
    new_comments: commentDaily.get(date) ?? 0,
  }));

  return c.json({ overview, totals: overview, time_series });
});

// ---------------------------------------------------------------------------
// 2. Moderation queue & post management
// ---------------------------------------------------------------------------

async function loadPostSummaries(postIds: string[]): Promise<Map<string, PostSummaryResponse>> {
  const out = new Map<string, PostSummaryResponse>();
  if (postIds.length === 0) return out;

  const rows = await db
    .select({ post: posts, author: users, category: categories })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.author_id))
    .leftJoin(categories, eq(categories.id, posts.category_id))
    .where(inArray(posts.id, postIds));

  const tagsByPost = await loadTagsForPosts(postIds);
  for (const row of rows) {
    out.set(
      row.post.id,
      toPostSummary(row.post, {
        author: row.author,
        category: row.category,
        tags: tagsByPost.get(row.post.id) ?? [],
        viewerIsStaff: true,
      }),
    );
  }
  return out;
}

async function summaryFor(postId: string): Promise<PostSummaryResponse> {
  const map = await loadPostSummaries([postId]);
  const summary = map.get(postId);
  if (!summary) throw notFound('Post not found');
  return summary;
}

async function listAdminPosts(c: Context) {
  const q = c.req.query();
  const page = PAGE(q.page);
  const limit = LIMIT(q.limit);

  const conditions = [];
  const wanted = (q.status ?? 'pending').toLowerCase();
  if (wanted !== 'all' && (wanted === 'pending' || wanted === 'approved' || wanted === 'rejected')) {
    conditions.push(eq(posts.status, wanted));
  }
  const categoryId = q.category_id ? asUuid(q.category_id) : null;
  // Same scoping as the public feed: a parent covers its children.
  if (categoryId) conditions.push(categoryScope(categoryId));
  if (q.search && q.search.trim()) {
    const term = `%${q.search.trim()}%`;
    conditions.push(or(ilike(posts.title, term), ilike(posts.content, term))!);
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRow, rows] = await Promise.all([
    db.select({ n: count() }).from(posts).where(where),
    db
      .select({ post: posts, author: users, category: categories })
      .from(posts)
      .innerJoin(users, eq(users.id, posts.author_id))
      .leftJoin(categories, eq(categories.id, posts.category_id))
      .where(where)
      // Highest supplement-spam score first: the queue is a triage list, not
      // an inbox. Ties fall back to newest.
      .orderBy(desc(posts.risk_score), desc(posts.created_at))
      .offset((page - 1) * limit)
      .limit(limit),
  ]);

  const total = Number(totalRow[0]?.n ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const tagsByPost = await loadTagsForPosts(rows.map((r) => r.post.id));

  return c.json({
    items: rows.map((r) =>
      toPostSummary(r.post, {
        author: r.author,
        category: r.category,
        tags: tagsByPost.get(r.post.id) ?? [],
        viewerIsStaff: true,
      }),
    ),
    total,
    page,
    limit,
    total_pages: totalPages,
    pages: totalPages,
  });
}

// adminService.ts calls /admin/moderation/posts first and only falls back to
// /admin/posts in a catch, so both paths have to stay live.
adminRoutes.get('/posts', listAdminPosts);
adminRoutes.get('/moderation/posts', listAdminPosts);

adminRoutes.put('/posts/:post_id/status', async (c) => {
  const id = asUuid(c.req.param('post_id'));
  if (!id) throw notFound('Post not found');
  const body = await parseBody(c, postModerationSchema);

  const rows = await db.select({ id: posts.id }).from(posts).where(eq(posts.id, id)).limit(1);
  if (!rows[0]) throw notFound('Post not found');

  const rejectionReason =
    body.status === 'approved' ? null : (body.rejection_reason ?? body.reason ?? null);

  await db
    .update(posts)
    .set({
      status: body.status,
      rejection_reason: rejectionReason ? sanitizePlainText(rejectionReason) : null,
      updated_at: new Date(),
    })
    .where(eq(posts.id, id));

  const post = await summaryFor(id);
  return c.json({
    success: true,
    message: `Post status updated to ${body.status}`,
    status: body.status,
    rejection_reason: post.rejection_reason,
    post,
  });
});

async function approvePost(c: Context) {
  const id = asUuid(c.req.param('post_id'));
  if (!id) throw notFound('Post not found');

  const rows = await db.select({ id: posts.id }).from(posts).where(eq(posts.id, id)).limit(1);
  if (!rows[0]) throw notFound('Post not found');

  await db
    .update(posts)
    .set({ status: 'approved', rejection_reason: null, updated_at: new Date() })
    .where(eq(posts.id, id));

  return c.json({
    success: true,
    message: 'Post approved successfully',
    status: 'approved',
    post: await summaryFor(id),
  });
}

async function rejectPost(c: Context) {
  const id = asUuid(c.req.param('post_id'));
  if (!id) throw notFound('Post not found');

  // The body is optional on this endpoint.
  let reason: string | null = null;
  try {
    const parsed = postRejectSchema.parse(await c.req.json());
    reason = parsed.reason ? sanitizePlainText(parsed.reason) : null;
  } catch {
    reason = null;
  }

  const rows = await db.select({ id: posts.id }).from(posts).where(eq(posts.id, id)).limit(1);
  if (!rows[0]) throw notFound('Post not found');

  await db
    .update(posts)
    .set({ status: 'rejected', rejection_reason: reason, updated_at: new Date() })
    .where(eq(posts.id, id));

  return c.json({
    success: true,
    message: 'Post rejected',
    status: 'rejected',
    rejection_reason: reason,
    post: await summaryFor(id),
  });
}

adminRoutes.post('/posts/:post_id/approve', approvePost);
adminRoutes.post('/moderation/posts/:post_id/approve', approvePost);
adminRoutes.post('/posts/:post_id/reject', rejectPost);
adminRoutes.post('/moderation/posts/:post_id/reject', rejectPost);


// ---------------------------------------------------------------------------
// 3. Report management
// ---------------------------------------------------------------------------

/** Resolves what a report points at, so the queue can show it in context. */
async function enrichReport(
  report: typeof reports.$inferSelect,
  reporter: typeof users.$inferSelect | null,
  resolver: typeof users.$inferSelect | null,
): Promise<ReportResponse> {
  let target_title: string | null = null;
  let target_author_name: string | null = null;

  if (report.target_type === 'post') {
    const rows = await db
      .select({ title: posts.title, username: users.username })
      .from(posts)
      .leftJoin(users, eq(users.id, posts.author_id))
      .where(eq(posts.id, report.target_id))
      .limit(1);
    if (rows[0]) {
      target_title = rows[0].title;
      target_author_name = rows[0].username ?? null;
    } else {
      target_title = '[Deleted Post]';
    }
  } else if (report.target_type === 'story') {
    const rows = await db
      .select({ caption: stories.caption, username: users.username })
      .from(stories)
      .leftJoin(users, eq(users.id, stories.author_id))
      .where(eq(stories.id, report.target_id))
      .limit(1);
    if (rows[0]) {
      target_title = rows[0].caption?.slice(0, 60) || 'Story không có chú thích';
      target_author_name = rows[0].username ?? null;
    } else {
      target_title = '[Story đã hết hạn hoặc bị xóa]';
    }
  } else if (report.target_type === 'comment') {
    const rows = await db
      .select({ content: comments.content, username: users.username })
      .from(comments)
      .leftJoin(users, eq(users.id, comments.author_id))
      .where(eq(comments.id, report.target_id))
      .limit(1);
    if (rows[0]) {
      target_title = rows[0].content.slice(0, 60);
      target_author_name = rows[0].username ?? null;
    } else {
      target_title = '[Deleted Comment]';
    }
  } else {
    const rows = await db
      .select({ username: users.username })
      .from(users)
      .where(eq(users.id, report.target_id))
      .limit(1);
    if (rows[0]) {
      target_title = rows[0].username;
      target_author_name = rows[0].username;
    } else {
      target_title = '[Deleted User]';
    }
  }

  return toReportResponse(report, { reporter, resolver, target_title, target_author_name });
}

async function loadReportWithPeople(id: string) {
  const reporterUsers = users;
  const rows = await db
    .select({ report: reports, reporter: reporterUsers })
    .from(reports)
    .leftJoin(reporterUsers, eq(reporterUsers.id, reports.reporter_id))
    .where(eq(reports.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  const resolver = row.report.resolved_by
    ? (await db.select().from(users).where(eq(users.id, row.report.resolved_by)).limit(1))[0] ?? null
    : null;
  return { report: row.report, reporter: row.reporter, resolver };
}

adminRoutes.get('/reports', async (c) => {
  const q = c.req.query();
  const page = PAGE(q.page);
  const limit = LIMIT(q.limit);

  const conditions = [];
  const wantedStatus = q.status?.toLowerCase();
  if (
    wantedStatus &&
    wantedStatus !== 'all' &&
    (wantedStatus === 'open' || wantedStatus === 'resolved' || wantedStatus === 'dismissed')
  ) {
    conditions.push(eq(reports.status, wantedStatus));
  }
  const wantedTarget = q.target_type?.toLowerCase();
  if (
    wantedTarget &&
    (wantedTarget === 'post' || wantedTarget === 'comment' || wantedTarget === 'user')
  ) {
    conditions.push(eq(reports.target_type, wantedTarget));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRow, rows] = await Promise.all([
    db.select({ n: count() }).from(reports).where(where),
    db
      .select({ report: reports, reporter: users })
      .from(reports)
      .leftJoin(users, eq(users.id, reports.reporter_id))
      .where(where)
      .orderBy(desc(reports.created_at))
      .offset((page - 1) * limit)
      .limit(limit),
  ]);

  const total = Number(totalRow[0]?.n ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const resolverIds = rows
    .map((r) => r.report.resolved_by)
    .filter((v): v is string => typeof v === 'string');
  const resolvers = new Map<string, typeof users.$inferSelect>();
  if (resolverIds.length > 0) {
    const found = await db.select().from(users).where(inArray(users.id, resolverIds));
    for (const u of found) resolvers.set(u.id, u);
  }

  const items = await Promise.all(
    rows.map((r) =>
      enrichReport(
        r.report,
        r.reporter,
        r.report.resolved_by ? resolvers.get(r.report.resolved_by) ?? null : null,
      ),
    ),
  );

  return c.json({ items, total, page, limit, total_pages: totalPages, pages: totalPages });
});

// adminService.ts:74 tries PATCH first and falls back to PUT at :77.
async function updateReportStatus(c: Context) {
  const me = currentUser(c);
  const id = asUuid(c.req.param('report_id'));
  if (!id) throw notFound('Report not found');

  const body = await parseBody(c, reportUpdateSchema);
  const existing = await loadReportWithPeople(id);
  if (!existing) throw notFound('Report not found');

  const patch: Record<string, unknown> = {
    status: body.status,
    resolved_by: me.id,
    resolved_at: new Date(),
    updated_at: new Date(),
  };
  if (body.resolution_notes !== undefined && body.resolution_notes !== null) {
    patch.resolution_notes = sanitizePlainText(body.resolution_notes);
  }

  const updated = await db.update(reports).set(patch).where(eq(reports.id, id)).returning();
  const report = updated[0];
  if (!report) throw notFound('Report not found');

  return c.json(await enrichReport(report, existing.reporter, me));
}

adminRoutes.put('/reports/:report_id', updateReportStatus);
adminRoutes.patch('/reports/:report_id', updateReportStatus);

adminRoutes.delete('/reports/:report_id/content', async (c) => {
  const me = currentUser(c);
  const id = asUuid(c.req.param('report_id'));
  if (!id) throw notFound('Report not found');

  const rows = await db.select().from(reports).where(eq(reports.id, id)).limit(1);
  const report = rows[0];
  if (!report) throw notFound('Report not found');

  const now = new Date();
  const NOTE = 'Content removed by moderator';

  if (report.target_type === 'post') {
    await db
      .update(posts)
      .set({
        status: 'rejected',
        is_published: false,
        rejection_reason: NOTE,
        updated_at: now,
      })
      .where(eq(posts.id, report.target_id));
  } else if (report.target_type === 'story') {
    // A story has no rejected state to move it into — removing it is the
    // only action, and it would have expired within the day anyway.
    await db.delete(stories).where(eq(stories.id, report.target_id));
  } else if (report.target_type === 'comment') {
    await db
      .update(comments)
      .set({
        is_deleted: true,
        content: '[Nội dung đã bị xóa do vi phạm tiêu chuẩn cộng đồng]',
        updated_at: now,
      })
      .where(eq(comments.id, report.target_id));
  } else {
    await db
      .update(users)
      .set({ is_active: false, updated_at: now })
      .where(eq(users.id, report.target_id));
  }

  // Every open report about the same target is resolved together, not just
  // the one that was acted on.
  await db
    .update(reports)
    .set({
      status: 'resolved',
      resolution_notes: NOTE,
      resolved_by: me.id,
      resolved_at: now,
      updated_at: now,
    })
    .where(
      or(
        and(
          eq(reports.target_type, report.target_type),
          eq(reports.target_id, report.target_id),
          eq(reports.status, 'open'),
        ),
        eq(reports.id, report.id),
      ),
    );

  return c.json({
    success: true,
    message: 'Reported content removed and report resolved',
    deleted_type: report.target_type,
    target_id: report.target_id,
  });
});

adminRoutes.delete('/reports/:report_id', async (c) => {
  const id = asUuid(c.req.param('report_id'));
  if (!id) throw notFound('Report not found');

  const deleted = await db
    .delete(reports)
    .where(eq(reports.id, id))
    .returning({ id: reports.id });
  if (deleted.length === 0) throw notFound('Report not found');
  return c.body(null, 204);
});

// ---------------------------------------------------------------------------
// 4. User management
// ---------------------------------------------------------------------------

adminRoutes.get('/users', async (c) => {
  const q = c.req.query();
  const page = PAGE(q.page);
  const limit = LIMIT(q.limit);

  const conditions = [];
  if (q.search && q.search.trim()) {
    const term = `%${q.search.trim()}%`;
    conditions.push(
      or(ilike(users.username, term), ilike(users.email, term), ilike(users.full_name, term))!,
    );
  }
  const role = q.role?.toLowerCase();
  if (
    role &&
    (role === 'guest' || role === 'user' || role === 'doctor' || role === 'moderator' || role === 'admin')
  ) {
    conditions.push(eq(users.role, role));
  }
  if (q.is_active !== undefined && q.is_active !== '') {
    conditions.push(eq(users.is_active, q.is_active === 'true' || q.is_active === '1'));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const order =
    q.sort_by === 'oldest'
      ? asc(users.created_at)
      : q.sort_by === 'username'
        ? asc(users.username)
        : desc(users.created_at);

  const [totalRow, rows] = await Promise.all([
    db.select({ n: count() }).from(users).where(where),
    db
      .select()
      .from(users)
      .where(where)
      .orderBy(order)
      .offset((page - 1) * limit)
      .limit(limit),
  ]);

  const total = Number(totalRow[0]?.n ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  // Two grouped queries instead of the two-per-user the Python loop ran.
  const ids = rows.map((u) => u.id);
  const postCounts = new Map<string, number>();
  const commentCounts = new Map<string, number>();
  if (ids.length > 0) {
    const [pc, cc] = await Promise.all([
      db
        .select({ author_id: posts.author_id, n: sql<number>`count(*)::int` })
        .from(posts)
        .where(inArray(posts.author_id, ids))
        .groupBy(posts.author_id),
      db
        .select({ author_id: comments.author_id, n: sql<number>`count(*)::int` })
        .from(comments)
        .where(inArray(comments.author_id, ids))
        .groupBy(comments.author_id),
    ]);
    for (const r of pc) postCounts.set(r.author_id, Number(r.n));
    for (const r of cc) commentCounts.set(r.author_id, Number(r.n));
  }

  return c.json({
    items: rows.map((u) =>
      toUserResponse(u, {
        post_count: postCounts.get(u.id) ?? 0,
        comment_count: commentCounts.get(u.id) ?? 0,
      }),
    ),
    total,
    page,
    limit,
    total_pages: totalPages,
    pages: totalPages,
  });
});

adminRoutes.put('/users/:user_id/role', requireAdminOnly, async (c) => {
  const me = currentUser(c);
  const id = asUuid(c.req.param('user_id'));
  if (!id) throw notFound('User not found');
  const body = await parseBody(c, userRoleUpdateSchema);

  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  const user = rows[0];
  if (!user) throw notFound('User not found');

  // An admin cannot demote themselves — that is how a forum ends up with
  // nobody who can administer it.
  if (me.id === user.id && body.role !== 'admin') {
    throw badRequest('Cannot modify your own administrative role');
  }

  const updated = await db
    .update(users)
    .set({ role: body.role, updated_at: new Date() })
    .where(eq(users.id, id))
    .returning();
  return c.json(toUserResponse(updated[0] ?? user));
});

adminRoutes.put('/users/:user_id/status', requireAdminOnly, async (c) => {
  const me = currentUser(c);
  const id = asUuid(c.req.param('user_id'));
  if (!id) throw notFound('User not found');
  const body = await parseBody(c, userStatusUpdateSchema);

  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  const user = rows[0];
  if (!user) throw notFound('User not found');

  if (me.id === user.id && !body.is_active) {
    throw badRequest('Cannot deactivate your own account');
  }

  const updated = await db
    .update(users)
    .set({ is_active: body.is_active, updated_at: new Date() })
    .where(eq(users.id, id))
    .returning();
  return c.json(toUserResponse(updated[0] ?? user));
});

// adminService.ts:112 calls this before falling back to the two PUT routes.
adminRoutes.patch('/users/:user_id', requireAdminOnly, async (c) => {
  const me = currentUser(c);
  const id = asUuid(c.req.param('user_id'));
  if (!id) throw notFound('User not found');
  const body = await parseBody(c, adminUserUpdateSchema);

  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  const user = rows[0];
  if (!user) throw notFound('User not found');

  if (body.is_active === false && me.id === user.id) {
    throw badRequest('Cannot deactivate your own account');
  }
  if (body.role !== undefined && body.role !== 'admin' && me.id === user.id) {
    throw badRequest('Cannot modify your own administrative role');
  }

  const patch: Record<string, unknown> = { updated_at: new Date() };
  if (body.role !== undefined) patch.role = body.role;
  if (body.is_active !== undefined) patch.is_active = body.is_active;
  if (body.specialty !== undefined && body.specialty !== null) {
    patch.specialty = sanitizePlainText(body.specialty);
  }
  if (body.bio !== undefined && body.bio !== null) patch.bio = sanitizePlainText(body.bio);

  const updated = await db.update(users).set(patch).where(eq(users.id, id)).returning();
  return c.json(toUserResponse(updated[0] ?? user));
});


// ---------------------------------------------------------------------------
// 5. Doctor licence verification
// ---------------------------------------------------------------------------

adminRoutes.get('/verifications', async (c) => {
  const q = c.req.query();
  const page = PAGE(q.page);
  const limit = LIMIT(q.limit);

  const wanted = (q.status ?? 'pending').toLowerCase();
  const where =
    wanted === 'all' || !['pending', 'approved', 'rejected'].includes(wanted)
      ? undefined
      : eq(doctorVerifications.status, wanted as 'pending' | 'approved' | 'rejected');

  const [totalRow, rows] = await Promise.all([
    db.select({ n: count() }).from(doctorVerifications).where(where),
    db
      .select({ request: doctorVerifications, applicant: users })
      .from(doctorVerifications)
      .leftJoin(users, eq(users.id, doctorVerifications.user_id))
      .where(where)
      .orderBy(desc(doctorVerifications.created_at))
      .offset((page - 1) * limit)
      .limit(limit),
  ]);

  const total = Number(totalRow[0]?.n ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return c.json({
    items: rows.map((r) => ({
      id: r.request.id,
      user_id: r.request.user_id,
      full_name: r.request.full_name,
      license_number: r.request.license_number,
      specialty: r.request.specialty,
      workplace: r.request.workplace,
      document_url: r.request.document_url,
      status: r.request.status,
      review_notes: r.request.review_notes,
      created_at: toIsoRequired(r.request.created_at),
      applicant: r.applicant ? toUserResponse(r.applicant) : null,
    })),
    total,
    page,
    limit,
    total_pages: totalPages,
    pages: totalPages,
  });
});

/**
 * Approving is what actually makes someone a verified doctor: it sets the
 * role, copies the declared specialty and workplace onto the profile, and
 * stamps verified_at — the only thing the blue tick reads.
 */
adminRoutes.put('/verifications/:id', requireAdminOnly, async (c) => {
  const me = currentUser(c);
  const id = asUuid(c.req.param('id'));
  if (!id) throw notFound('Verification request not found');

  const body = await parseBody(c, verificationReviewSchema);
  const rows = await db
    .select()
    .from(doctorVerifications)
    .where(eq(doctorVerifications.id, id))
    .limit(1);
  const request = rows[0];
  if (!request) throw notFound('Verification request not found');
  if (request.status !== 'pending') {
    throw badRequest('Yêu cầu này đã được xử lý.');
  }

  const now = new Date();
  await db
    .update(doctorVerifications)
    .set({
      status: body.status,
      review_notes: body.review_notes ? sanitizePlainText(body.review_notes) : null,
      reviewed_by: me.id,
      reviewed_at: now,
      updated_at: now,
    })
    .where(eq(doctorVerifications.id, id));

  if (body.status === 'approved') {
    await db
      .update(users)
      .set({
        role: 'doctor',
        verified_at: now,
        specialty: request.specialty,
        workplace: request.workplace,
        updated_at: now,
      })
      .where(eq(users.id, request.user_id));
  }

  return c.json({ success: true, status: body.status });
});
