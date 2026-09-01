import { Hono } from 'hono';
import { and, desc, eq, lt, or } from 'drizzle-orm';
import { db } from '../db/index.js';
import { bookmarks, categories, posts, users } from '../db/schema.js';
import { findPostOr404 } from '../lib/findPost.js';
import {
  decodeCursor,
  encodeCursor,
  loadReactionBreakdowns,
  loadTagsForPosts,
  loadViewerState,
} from '../lib/postQueries.js';
import { toPostSummary } from '../schemas/responses.js';
import { currentUser, requireAuth } from '../middleware/auth.js';

export const bookmarkRoutes = new Hono();

bookmarkRoutes.post('/posts/:post_id/bookmark', requireAuth, async (c) => {
  const me = currentUser(c);
  const post = await findPostOr404(c.req.param('post_id'));

  const existing = await db
    .select({ id: bookmarks.id })
    .from(bookmarks)
    .where(and(eq(bookmarks.user_id, me.id), eq(bookmarks.post_id, post.id)))
    .limit(1);

  if (existing[0]) {
    await db.delete(bookmarks).where(eq(bookmarks.id, existing[0].id));
    return c.json({ is_bookmarked: false });
  }

  await db
    .insert(bookmarks)
    .values({ user_id: me.id, post_id: post.id })
    .onConflictDoNothing();
  return c.json({ is_bookmarked: true });
});

bookmarkRoutes.get('/users/me/bookmarks', requireAuth, async (c) => {
  const me = currentUser(c);
  const limitRaw = Number(c.req.query('limit') ?? 10);
  const limit = Math.min(50, Math.max(1, Number.isFinite(limitRaw) ? Math.trunc(limitRaw) : 10));

  // The cursor here keys off the bookmark's created_at, not the post's.
  const conditions = [eq(bookmarks.user_id, me.id), eq(posts.is_published, true)];
  const cursor = c.req.query('cursor');
  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (decoded) {
      conditions.push(
        or(
          lt(bookmarks.created_at, decoded.t),
          and(eq(bookmarks.created_at, decoded.t), lt(posts.id, decoded.id)),
        )!,
      );
    }
  }

  const rows = await db
    .select({
      post: posts,
      author: users,
      category: categories,
      bookmarked_at: bookmarks.created_at,
    })
    .from(bookmarks)
    .innerJoin(posts, eq(posts.id, bookmarks.post_id))
    .innerJoin(users, eq(users.id, posts.author_id))
    .leftJoin(categories, eq(categories.id, posts.category_id))
    .where(and(...conditions))
    .orderBy(desc(bookmarks.created_at), desc(posts.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const ids = page.map((r) => r.post.id);

  const [tagsByPost, breakdowns, viewer] = await Promise.all([
    loadTagsForPosts(ids),
    loadReactionBreakdowns(ids),
    loadViewerState(ids, me.id),
  ]);

  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? encodeCursor(last.bookmarked_at, last.post.id) : null;

  return c.json({
    items: page.map((r) =>
      toPostSummary(r.post, {
        author: r.author,
        category: r.category,
        tags: tagsByPost.get(r.post.id) ?? [],
        userReaction: viewer.reactions.get(r.post.id) ?? null,
        breakdown: breakdowns.get(r.post.id),
        isBookmarked: true,
      }),
    ),
    next_cursor: nextCursor,
    has_more: hasMore,
    limit,
    total: null,
  });
});
