import { Hono } from 'hono';
import { and, count, desc, eq, isNotNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { posts, users } from '../db/schema.js';
import { toUserResponse } from '../schemas/responses.js';

export const statsRoutes = new Hono();

/**
 * Vài số liệu công khai cho sidebar. Cùng nguồn với /admin/stats nhưng chỉ
 * những gì ai cũng xem được — không lộ số bài chờ duyệt hay số báo cáo đang mở.
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

/**
 * Ô "Bác sĩ nổi bật" ở sidebar.
 *
 * Chỉ bác sĩ đã được duyệt giấy phép (verified_at) mới lọt vào — vai trò do
 * admin gán thôi thì chưa đủ, vì ô này nằm ngay cạnh nội dung y tế và người
 * đọc sẽ hiểu đó là bảo chứng. "Nổi bật" xếp theo số bài đã được duyệt, nên
 * danh sách tự đổi theo người thực sự đang trả lời, không cần ai chọn tay.
 */
statsRoutes.get('/doctors/featured', async (c) => {
  const limitRaw = Number(c.req.query('limit') ?? 3);
  const limit = Math.min(10, Math.max(1, Number.isFinite(limitRaw) ? Math.trunc(limitRaw) : 3));

  const rows = await db
    .select({ user: users, post_count: count(posts.id) })
    .from(users)
    .leftJoin(
      posts,
      and(eq(posts.author_id, users.id), eq(posts.status, 'approved'), eq(posts.is_anonymous, false)),
    )
    .where(and(eq(users.role, 'doctor'), eq(users.is_active, true), isNotNull(users.verified_at)))
    .groupBy(users.id)
    .orderBy(desc(count(posts.id)), desc(users.verified_at))
    .limit(limit);

  c.header('Cache-Control', 'public, max-age=300');
  return c.json(
    rows.map((r) => ({ ...toUserResponse(r.user), post_count: Number(r.post_count) })),
  );
});
