import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { asUuid } from '../core/security.js';
import { forbidden, notFound } from '../core/errors.js';
import { parseBody } from '../lib/validate.js';
import { userUpdateSchema } from '../schemas/requests.js';
import { toUserResponse } from '../schemas/responses.js';
import { currentUser, requireAuth, requireRole } from '../middleware/auth.js';
import { sanitizePlainText } from '../lib/sanitize.js';

export const userRoutes = new Hono();

/**
 * Every handler here returns toUserResponse(row), never the row itself.
 * The Python versions returned the ORM object and relied on
 * response_model=UserResponse to drop hashed_password on the way out.
 */

userRoutes.get('/:user_id', requireAuth, async (c) => {
  const id = asUuid(c.req.param('user_id'));
  if (!id) throw notFound('User not found');

  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  const user = rows[0];
  if (!user) throw notFound('User not found');
  return c.json(toUserResponse(user));
});

userRoutes.put('/:user_id', requireAuth, async (c) => {
  const me = currentUser(c);
  const rawId = c.req.param('user_id');
  if (me.id !== rawId && me.role !== 'admin') {
    throw forbidden('Not enough permissions');
  }
  const id = asUuid(rawId);
  if (!id) throw notFound('User not found');

  const body = await parseBody(c, userUpdateSchema);
  const patch: Record<string, string | null> = {};
  if (body.full_name !== undefined && body.full_name !== null) {
    patch.full_name = sanitizePlainText(body.full_name);
  }
  if (body.avatar_url !== undefined && body.avatar_url !== null) {
    patch.avatar_url = body.avatar_url;
  }
  if (body.specialty !== undefined && body.specialty !== null) {
    patch.specialty = sanitizePlainText(body.specialty);
  }
  if (body.bio !== undefined && body.bio !== null) {
    patch.bio = sanitizePlainText(body.bio);
  }

  if (Object.keys(patch).length === 0) {
    const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
    const user = rows[0];
    if (!user) throw notFound('User not found');
    return c.json(toUserResponse(user));
  }

  const updated = await db
    .update(users)
    .set({ ...patch, updated_at: new Date() })
    .where(eq(users.id, id))
    .returning();
  const user = updated[0];
  if (!user) throw notFound('User not found');
  return c.json(toUserResponse(user));
});

userRoutes.get('/', requireAuth, requireRole('admin', 'moderator'), async (c) => {
  const skip = Math.max(0, Number(c.req.query('skip') ?? 0) || 0);
  const limit = Math.min(100, Math.max(1, Number(c.req.query('limit') ?? 100) || 100));

  const rows = await db.select().from(users).offset(skip).limit(limit);
  return c.json(rows.map((u) => toUserResponse(u)));
});

userRoutes.delete('/:user_id', requireAuth, requireRole('admin'), async (c) => {
  const id = asUuid(c.req.param('user_id'));
  if (!id) throw notFound('User not found');

  const updated = await db
    .update(users)
    .set({ is_active: false, updated_at: new Date() })
    .where(eq(users.id, id))
    .returning({ id: users.id });
  if (updated.length === 0) throw notFound('User not found');
  return c.body(null, 204);
});
