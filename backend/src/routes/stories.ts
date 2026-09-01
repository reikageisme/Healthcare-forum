import { Hono } from 'hono';
import { and, desc, eq, gt } from 'drizzle-orm';
import { db } from '../db/index.js';
import { stories, users, type StoryRow, type UserRow } from '../db/schema.js';
import { badRequest, forbidden, notFound } from '../core/errors.js';
import { asUuid } from '../core/security.js';
import { parseBody } from '../lib/validate.js';
import { sanitizePlainText } from '../lib/sanitize.js';
import { assessContent } from '../lib/spamGuard.js';
import { toIsoRequired } from '../lib/datetime.js';
import { storyCreateSchema } from '../schemas/requests.js';
import { toUserResponse } from '../schemas/responses.js';
import { currentUser, optionalAuth, requireAuth } from '../middleware/auth.js';
import { storyRateLimit } from '../middleware/rateLimit.js';

export const storyRoutes = new Hono();

const STORY_LIFETIME_MS = 24 * 60 * 60_000;

function toStory(row: StoryRow, author: UserRow) {
  return {
    id: row.id,
    image_url: row.image_url,
    caption: row.caption,
    created_at: toIsoRequired(row.created_at),
    expires_at: toIsoRequired(row.expires_at),
    author: toUserResponse(author),
  };
}

/**
 * Active stories, grouped by author so the carousel shows one ring per person.
 * Expired rows are filtered out by the query rather than deleted by a job, so
 * a story stops being served the moment it expires even if no cleanup ran.
 */
storyRoutes.get('/', optionalAuth, async (c) => {
  const rows = await db
    .select({ story: stories, author: users })
    .from(stories)
    .innerJoin(users, eq(users.id, stories.author_id))
    .where(and(gt(stories.expires_at, new Date()), eq(users.is_active, true)))
    .orderBy(desc(stories.created_at))
    .limit(300);

  const byAuthor = new Map<string, { author: UserRow; items: ReturnType<typeof toStory>[] }>();
  for (const row of rows) {
    const group = byAuthor.get(row.author.id) ?? { author: row.author, items: [] };
    group.items.push(toStory(row.story, row.author));
    byAuthor.set(row.author.id, group);
  }

  const me = c.get('currentUser');
  const groups = [...byAuthor.values()].map((g) => ({
    author: toUserResponse(g.author),
    // Oldest first inside a group: a viewer plays them in the order posted.
    items: [...g.items].reverse(),
    latest_at: g.items[0]?.created_at ?? null,
  }));

  // The viewer's own ring sits first, the way every stories UI behaves.
  groups.sort((a, b) => {
    if (me && a.author.id === me.id) return -1;
    if (me && b.author.id === me.id) return 1;
    return (b.latest_at ?? '').localeCompare(a.latest_at ?? '');
  });

  return c.json({ items: groups });
});

/**
 * A story cannot go through the moderation queue: it would expire before a
 * moderator reached it, and the queue is what protects the forum from
 * supplement ads. So the same risk rules run here synchronously and a risky
 * story is refused outright rather than published and reviewed later.
 */
storyRoutes.post('/', requireAuth, storyRateLimit, async (c) => {
  const me = currentUser(c);
  const body = await parseBody(c, storyCreateSchema);

  if (!body.image_url.startsWith('/uploads/')) {
    throw badRequest('Ảnh story phải được tải lên qua chức năng tải ảnh của diễn đàn.');
  }

  const caption = body.caption ? sanitizePlainText(body.caption) : null;
  const risk = assessContent(
    { content: caption ?? '' },
    { createdAt: me.created_at, role: me.role },
  );
  if (risk.forceReview) {
    throw badRequest(
      `Nội dung story có dấu hiệu quảng cáo nên không được đăng (${risk.reasons.join(', ')}). ` +
        'Story hết hạn sau 24 giờ nên không thể đưa vào hàng chờ kiểm duyệt.',
    );
  }

  const now = new Date();
  const inserted = await db
    .insert(stories)
    .values({
      author_id: me.id,
      image_url: body.image_url,
      caption,
      created_at: now,
      expires_at: new Date(now.getTime() + STORY_LIFETIME_MS),
    })
    .returning();

  const row = inserted[0];
  if (!row) throw badRequest('Không đăng được story.');
  return c.json(toStory(row, me), 201);
});

storyRoutes.delete('/:id', requireAuth, async (c) => {
  const me = currentUser(c);
  const id = asUuid(c.req.param('id'));
  if (!id) throw notFound('Story not found');

  const rows = await db.select().from(stories).where(eq(stories.id, id)).limit(1);
  const story = rows[0];
  if (!story) throw notFound('Story not found');

  const isStaff = me.role === 'admin' || me.role === 'moderator';
  if (story.author_id !== me.id && !isStaff) {
    throw forbidden('Not enough permissions to delete this story');
  }

  await db.delete(stories).where(eq(stories.id, id));
  return c.body(null, 204);
});
