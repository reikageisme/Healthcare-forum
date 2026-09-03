import { Hono } from 'hono';
import { and, asc, count, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { categories, posts, users } from '../db/schema.js';
import { categoryPostCount } from '../lib/categoryTree.js';
import { toCategoryResponse, toUserResponse } from '../schemas/responses.js';
import { settings } from '../core/config.js';

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

/**
 * Số trả lời của một box, tính cả các box con và cháu.
 *
 * Viết thẳng "categories"."id" chứ không nội suy cột, cùng lý do như
 * categoryPostCount: trong phần SELECT drizzle in ra "id" trần và truy vấn con
 * sẽ hiểu nhầm là cột của posts, khiến mọi số đếm về 0.
 */
const categoryReplyCount = sql<number>`(
  select count(*)::int from "comments" c
    join "posts" p on p.id = c.post_id
   where c.is_deleted = false
     and p.is_published = true
     and p.status = 'approved'
     and (p.category_id = "categories"."id" or p.category_id in (
       select ch.id from "categories" ch
        where ch.parent_id = "categories"."id"
           or ch.parent_id in (
             select g.id from "categories" g where g.parent_id = "categories"."id"
           )
     ))
)`;

/** Thớt mới nhất của box, để cột "Bài mới nhất" ngoài trang danh sách. */
const categoryLastPost = sql<{
  id: string;
  title: string;
  created_at: string;
  author_name: string | null;
} | null>`(
  select json_build_object(
           'id', p.id,
           'title', p.title,
           'created_at', p.created_at,
           'author_name', case when p.is_anonymous then null
                               else coalesce(u.full_name, u.username) end
         )
    from "posts" p join "users" u on u.id = p.author_id
   where p.is_published = true
     and p.status = 'approved'
     and (p.category_id = "categories"."id" or p.category_id in (
       select ch.id from "categories" ch
        where ch.parent_id = "categories"."id"
           or ch.parent_id in (
             select g.id from "categories" g where g.parent_id = "categories"."id"
           )
     ))
   order by p.created_at desc
   limit 1
)`;

/**
 * Trang chủ diễn đàn: vẫn là cây chuyên mục cũ, chỉ kèm thêm ba con số mỗi
 * box cần để hiển thị như một forum — số thớt, số trả lời, thớt mới nhất.
 *
 * Trả về danh sách phẳng có parent_id đúng như GET /categories; phía client
 * đã có sẵn hàm dựng cây nên không cần một endpoint lồng thứ hai để lệch nhau.
 */
statsRoutes.get('/forum', async (c) => {
  const rows = await db
    .select({
      category: categories,
      post_count: categoryPostCount,
      reply_count: categoryReplyCount,
      last_post: categoryLastPost,
    })
    .from(categories)
    .orderBy(asc(categories.sort_order), asc(categories.name));

  c.header('Cache-Control', 'public, max-age=60');
  return c.json(
    rows.map((r) => ({
      ...toCategoryResponse(r.category, Number(r.post_count)),
      thread_count: Number(r.post_count),
      reply_count: Number(r.reply_count),
      last_post: r.last_post ?? null,
    })),
  );
});

/**
 * Mạng lưới các trang anh em, cho thẻ ở sidebar.
 *
 * Trang đang mở được đánh dấu bằng cách so URL với SITE_URL, nên cùng một cấu
 * hình dùng chung cho mọi trang trong mạng lưới mà không trang nào phải tự
 * loại mình ra khỏi danh sách.
 */
statsRoutes.get('/network', (c) => {
  const here = settings.SITE_URL.replace(/\/+$/, '');
  c.header('Cache-Control', 'public, max-age=3600');
  return c.json({
    name: settings.NETWORK_NAME,
    tagline: settings.NETWORK_TAGLINE,
    sites: settings.NETWORK_SITES.map((site) => ({
      ...site,
      is_current: site.url.replace(/\/+$/, '') === here,
    })),
    footer_links: settings.FOOTER_LINKS,
    contact_email: settings.CONTACT_EMAIL,
  });
});
