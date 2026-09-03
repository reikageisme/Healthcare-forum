import { Hono } from 'hono';
import { and, count, eq, isNotNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { posts, users } from '../db/schema.js';

export const statsRoutes = new Hono();

/**
 * Số liệu công khai cho ô "Thống kê cộng đồng" ở sidebar. Cùng nguồn với
 * /admin/stats nhưng chỉ ba con số ai cũng xem được — không lộ số bài chờ
 * duyệt hay số báo cáo đang mở.
 */
statsRoutes.get('/stats', async (c) => {
  const [members, published, solved] = await Promise.all([
    db.select({ n: count() }).from(users).where(eq(users.is_active, true)),
    db
      .select({ n: count() })
      .from(posts)
      .where(and(eq(posts.status, 'approved'), eq(posts.is_published, true))),
    db
      .select({ n: count() })
      .from(posts)
      .where(and(eq(posts.post_type, 'question'), isNotNull(posts.accepted_comment_id))),
  ]);

  c.header('Cache-Control', 'public, max-age=300');
  return c.json({
    total_members: Number(members[0]?.n ?? 0),
    total_posts: Number(published[0]?.n ?? 0),
    total_solved_questions: Number(solved[0]?.n ?? 0),
  });
});
