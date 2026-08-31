import { Hono } from 'hono';
import { and, asc, count, desc, eq, ilike, or } from 'drizzle-orm';
import { db } from '../db/index.js';
import { postTags, posts, tags } from '../db/schema.js';
import { notFound } from '../core/errors.js';
import { asUuid } from '../core/security.js';
import { toTagResponse, toTagWithCount } from '../schemas/responses.js';

export const tagRoutes = new Hono();

/**
 * The post_count carried by /tags/hot and /tags/{id_or_slug} counts rows in
 * post_tags, not approved posts: tags.py left-joins posts with a status
 * filter but then counts post_tags.post_id, which the outer join cannot
 * reduce. Reproduced as-is so the numbers in the sidebar do not move.
 */
const linkCountJoins = {
  postTagsOn: eq(postTags.tag_id, tags.id),
  postsOn: and(
    eq(posts.id, postTags.post_id),
    eq(posts.is_published, true),
    eq(posts.status, 'approved'),
  ),
};

// /hot and /search must be registered before /:id_or_slug, or they would be
// swallowed by the parameter route.
tagRoutes.get('/hot', async (c) => {
  const limitRaw = Number(c.req.query('limit') ?? 10);
  const limit = Math.min(50, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 10));

  const rows = await db
    .select({ tag: tags, post_count: count(postTags.post_id) })
    .from(tags)
    .leftJoin(postTags, linkCountJoins.postTagsOn)
    .leftJoin(posts, linkCountJoins.postsOn)
    .groupBy(tags.id)
    .orderBy(desc(count(postTags.post_id)), asc(tags.name))
    .limit(limit);

  return c.json(rows.map((r) => toTagWithCount(r.tag, Number(r.post_count))));
});

tagRoutes.get('/search', async (c) => {
  const q = (c.req.query('q') ?? '').trim();
  const limitRaw = Number(c.req.query('limit') ?? 20);
  const limit = Math.min(50, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 20));

  const rows = q
    ? await db
        .select()
        .from(tags)
        .where(or(ilike(tags.name, `%${q}%`), ilike(tags.slug, `%${q}%`)))
        .orderBy(asc(tags.name))
        .limit(limit)
    : await db.select().from(tags).orderBy(asc(tags.name)).limit(limit);

  return c.json(rows.map(toTagResponse));
});

tagRoutes.get('/', async (c) => {
  const skip = Math.max(0, Number(c.req.query('skip') ?? 0) || 0);
  const limitRaw = Number(c.req.query('limit') ?? 100);
  const limit = Math.min(500, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 100));

  const rows = await db.select().from(tags).orderBy(asc(tags.name)).offset(skip).limit(limit);
  return c.json(rows.map(toTagResponse));
});

tagRoutes.get('/:id_or_slug', async (c) => {
  const key = c.req.param('id_or_slug');
  const id = asUuid(key);

  const rows = await db
    .select({ tag: tags, post_count: count(postTags.post_id) })
    .from(tags)
    .leftJoin(postTags, linkCountJoins.postTagsOn)
    .leftJoin(posts, linkCountJoins.postsOn)
    .where(id ? eq(tags.id, id) : eq(tags.slug, key))
    .groupBy(tags.id)
    .limit(1);

  const row = rows[0];
  if (!row) throw notFound('Tag not found');
  return c.json(toTagWithCount(row.tag, Number(row.post_count)));
});
