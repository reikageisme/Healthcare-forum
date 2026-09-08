import { Hono } from 'hono';
import { and, count, desc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { notifications, users } from '../db/schema.js';
import { notFound } from '../core/errors.js';
import { asUuid } from '../core/security.js';
import { currentUser, requireAuth } from '../middleware/auth.js';
import { markAllRead } from '../lib/notify.js';
import { toIsoRequired } from '../lib/datetime.js';

export const notificationRoutes = new Hono();

/**
 * Danh sách thông báo của chính mình, kèm số chưa đọc.
 *
 * Một lần gọi trả cả hai: chuông cần con số, bảng xổ cần danh sách, và tách
 * làm hai endpoint chỉ để rồi client nào cũng gọi cả hai.
 */
notificationRoutes.get('/notifications', requireAuth, async (c) => {
  const me = currentUser(c);
  const limitRaw = Number(c.req.query('limit') ?? 20);
  const limit = Math.min(50, Math.max(1, Number.isFinite(limitRaw) ? Math.trunc(limitRaw) : 20));

  const [rows, unread] = await Promise.all([
    db
      .select({ notification: notifications, actor: users })
      .from(notifications)
      .leftJoin(users, eq(users.id, notifications.actor_id))
      .where(eq(notifications.user_id, me.id))
      .orderBy(desc(notifications.created_at))
      .limit(limit),
    db
      .select({ n: count() })
      .from(notifications)
      .where(and(eq(notifications.user_id, me.id), eq(notifications.is_read, false))),
  ]);

  return c.json({
    items: rows.map((r) => ({
      id: r.notification.id,
      type: r.notification.type,
      title: r.notification.title,
      body: r.notification.body,
      link: r.notification.link,
      is_read: r.notification.is_read,
      created_at: toIsoRequired(r.notification.created_at),
      actor: r.actor
        ? {
            id: r.actor.id,
            username: r.actor.username,
            full_name: r.actor.full_name,
            avatar_url: r.actor.avatar_url,
          }
        : null,
    })),
    unread_count: Number(unread[0]?.n ?? 0),
  });
});

notificationRoutes.post('/notifications/read-all', requireAuth, async (c) => {
  await markAllRead(currentUser(c).id);
  return c.body(null, 204);
});

notificationRoutes.post('/notifications/:id/read', requireAuth, async (c) => {
  const me = currentUser(c);
  const id = asUuid(c.req.param('id'));
  if (!id) throw notFound('Notification not found');

  // Điều kiện user_id nằm ngay trong WHERE: không ai đánh dấu đọc hộ thông
  // báo của người khác, và cũng không cần một lần đọc để kiểm quyền.
  const updated = await db
    .update(notifications)
    .set({ is_read: true })
    .where(and(eq(notifications.id, id), eq(notifications.user_id, me.id)))
    .returning({ id: notifications.id });
  if (updated.length === 0) throw notFound('Notification not found');

  return c.body(null, 204);
});
