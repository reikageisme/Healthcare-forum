import { Hono } from 'hono';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { comments, posts, reports, users } from '../db/schema.js';
import { badRequest, notFound } from '../core/errors.js';
import { parseBody } from '../lib/validate.js';
import { sanitizePlainText } from '../lib/sanitize.js';
import { reportCreateSchema } from '../schemas/requests.js';
import { toReportResponse } from '../schemas/responses.js';
import { currentUser, requireAuth } from '../middleware/auth.js';
import { reportRateLimit } from '../middleware/rateLimit.js';

export const reportRoutes = new Hono();

/**
 * Rate limited: flooding this endpoint is the cheapest way to bury the
 * moderation queue, and the queue is what the whole moderation model rests
 * on. The Python version had no limit at all.
 */
reportRoutes.post('/', requireAuth, reportRateLimit, async (c) => {
  const me = currentUser(c);
  const body = await parseBody(c, reportCreateSchema);

  let targetTitle: string;
  if (body.target_type === 'post') {
    const rows = await db
      .select({ title: posts.title })
      .from(posts)
      .where(eq(posts.id, body.target_id))
      .limit(1);
    if (!rows[0]) throw notFound('Target post not found');
    targetTitle = rows[0].title;
  } else if (body.target_type === 'comment') {
    const rows = await db
      .select({ content: comments.content })
      .from(comments)
      .where(eq(comments.id, body.target_id))
      .limit(1);
    if (!rows[0]) throw notFound('Target comment not found');
    targetTitle = rows[0].content.slice(0, 50);
  } else {
    const rows = await db
      .select({ username: users.username })
      .from(users)
      .where(eq(users.id, body.target_id))
      .limit(1);
    if (!rows[0]) throw notFound('Target user not found');
    targetTitle = rows[0].username;
  }

  const duplicate = await db
    .select({ id: reports.id })
    .from(reports)
    .where(
      and(
        eq(reports.reporter_id, me.id),
        eq(reports.target_type, body.target_type),
        eq(reports.target_id, body.target_id),
        eq(reports.status, 'open'),
      ),
    )
    .limit(1);
  if (duplicate[0]) throw badRequest('You have already reported this content');

  const inserted = await db
    .insert(reports)
    .values({
      reporter_id: me.id,
      target_type: body.target_type,
      target_id: body.target_id,
      report_type: body.report_type || 'spam',
      reason: sanitizePlainText(body.reason),
      details: body.details ? sanitizePlainText(body.details) : null,
      status: 'open',
    })
    .returning();
  const report = inserted[0];
  if (!report) throw badRequest('Could not create report');

  return c.json(toReportResponse(report, { reporter: me, target_title: targetTitle }), 201);
});
