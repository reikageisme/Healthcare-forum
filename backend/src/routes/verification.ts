import { Hono } from 'hono';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { doctorVerifications, users } from '../db/schema.js';
import { badRequest, notFound } from '../core/errors.js';
import { parseBody } from '../lib/validate.js';
import { sanitizePlainText } from '../lib/sanitize.js';
import { toIso } from '../lib/datetime.js';
import { verificationSubmitSchema } from '../schemas/requests.js';
import { currentUser, requireAuth } from '../middleware/auth.js';
import { asUuid } from '../core/security.js';

export const verificationRoutes = new Hono();

/**
 * Practising-licence verification. On a health forum trust is the product,
 * and until now `role=doctor` was just a switch an admin could flip.
 * Approval (in the admin routes) is what sets users.verified_at.
 */

function toVerification(row: typeof doctorVerifications.$inferSelect) {
  return {
    id: row.id,
    user_id: row.user_id,
    full_name: row.full_name,
    license_number: row.license_number,
    specialty: row.specialty,
    workplace: row.workplace,
    document_url: row.document_url,
    status: row.status,
    review_notes: row.review_notes,
    reviewed_at: toIso(row.reviewed_at),
    created_at: toIso(row.created_at),
  };
}

/** The submitter's own latest request, so the UI can show its state. */
verificationRoutes.get('/me', requireAuth, async (c) => {
  const me = currentUser(c);
  const rows = await db
    .select()
    .from(doctorVerifications)
    .where(eq(doctorVerifications.user_id, me.id))
    .orderBy(desc(doctorVerifications.created_at))
    .limit(1);

  return c.json({
    verified_at: toIso(me.verified_at),
    request: rows[0] ? toVerification(rows[0]) : null,
  });
});

verificationRoutes.post('/', requireAuth, async (c) => {
  const me = currentUser(c);
  const body = await parseBody(c, verificationSubmitSchema);

  if (me.verified_at) throw badRequest('Tài khoản của bạn đã được xác thực.');

  const pending = await db
    .select({ id: doctorVerifications.id })
    .from(doctorVerifications)
    .where(
      and(eq(doctorVerifications.user_id, me.id), eq(doctorVerifications.status, 'pending')),
    )
    .limit(1);
  if (pending[0]) throw badRequest('Bạn đã có một yêu cầu đang chờ duyệt.');

  // The document comes from POST /upload, which already validates that the
  // bytes really are an image and stores it under /uploads.
  if (!body.document_url.startsWith('/uploads/')) {
    throw badRequest('Ảnh giấy phép phải được tải lên qua chức năng tải ảnh của diễn đàn.');
  }

  const inserted = await db
    .insert(doctorVerifications)
    .values({
      user_id: me.id,
      full_name: sanitizePlainText(body.full_name),
      license_number: sanitizePlainText(body.license_number),
      specialty: body.specialty ? sanitizePlainText(body.specialty) : null,
      workplace: body.workplace ? sanitizePlainText(body.workplace) : null,
      document_url: body.document_url,
      status: 'pending',
    })
    .returning();

  const row = inserted[0];
  if (!row) throw badRequest('Không tạo được yêu cầu xác thực.');
  return c.json(toVerification(row), 201);
});

/**
 * Public: what a reader is told about a verified doctor. Never exposes the
 * licence number or the document — those are for reviewers only.
 */
verificationRoutes.get('/users/:user_id', async (c) => {
  const id = asUuid(c.req.param('user_id'));
  if (!id) throw notFound('User not found');

  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      full_name: users.full_name,
      role: users.role,
      specialty: users.specialty,
      workplace: users.workplace,
      verified_at: users.verified_at,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  const user = rows[0];
  if (!user) throw notFound('User not found');

  return c.json({
    id: user.id,
    username: user.username,
    full_name: user.full_name,
    role: user.role,
    specialty: user.specialty,
    workplace: user.workplace,
    verified_at: toIso(user.verified_at),
  });
});

