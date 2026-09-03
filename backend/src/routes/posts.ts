import { Hono } from 'hono';
import { and, desc, eq, ilike, lt, or, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { categories, comments, posts, tags, postTags, users } from '../db/schema.js';
import { badRequest, forbidden, notFound } from '../core/errors.js';
import { asUuid } from '../core/security.js';
import { parseBody } from '../lib/validate.js';
import { sanitizePlainText, sanitizeRichText, stripHtmlAndTruncate } from '../lib/sanitize.js';
import { deaccent, toSearchText } from '../lib/slugify.js';
import { assessContent } from '../lib/spamGuard.js';
import {
  decodeCursor,
  encodeCursor,
  generateUniqueSlug,
  getReactionBreakdown,
  loadPostByIdOrSlug,
  loadReactionBreakdowns,
  loadTagsForPosts,
  loadViewerState,
  resolveTags,
  setPostTags,
} from '../lib/postQueries.js';
import { acceptAnswerSchema, postCreateSchema, postUpdateSchema } from '../schemas/requests.js';
import { toPostDetail, toPostSummary } from '../schemas/responses.js';
import { currentUser, optionalAuth, requireAuth } from '../middleware/auth.js';
import { categoryScope } from '../lib/categoryTree.js';

export const postRoutes = new Hono();

const EMPTY_BREAKDOWN = { helpful: 0, like: 0, informative: 0, total: 0 } as const;

postRoutes.post('/', requireAuth, async (c) => {
  const me = currentUser(c);
  const body = await parseBody(c, postCreateSchema);

  if (body.category_id) {
    const cat = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.id, body.category_id))
      .limit(1);
    if (cat.length === 0) throw notFound('Category not found');
  }

  // Bodies are TipTap HTML and end up in dangerouslySetInnerHTML on the
  // detail page and in the moderation preview. Cleaning on write means the
  // stored row is safe for every reader, moderators included.
  const content = sanitizeRichText(body.content);
  const title = sanitizePlainText(body.title);

  const slug = await generateUniqueSlug(title);
  const excerpt = body.excerpt
    ? sanitizePlainText(body.excerpt)
    : stripHtmlAndTruncate(content);

  // Hybrid moderation: trusted roles publish straight away, everyone else
  // lands in the review queue.
  const trusted = me.role === 'doctor' || me.role === 'moderator' || me.role === 'admin';

  // Supplement spam is the failure mode for a Vietnamese health forum, so a
  // risky post is queued even when its author would normally bypass review.
  const risk = assessContent({ title, content }, { createdAt: me.created_at, role: me.role });
  const status = trusted && !risk.forceReview ? ('approved' as const) : ('pending' as const);

  const inserted = await db
    .insert(posts)
    .values({
      title,
      slug,
      content,
      excerpt,
      thumbnail: body.thumbnail ?? null,
      post_type: body.post_type,
      status,
      risk_score: risk.score,
      is_anonymous: body.is_anonymous ?? false,
      search_text: toSearchText(title, excerpt, content),
      author_id: me.id,
      category_id: body.category_id ?? null,
    })
    .returning();

  const post = inserted[0];
  if (!post) throw notFound('Post not found');

  const rawTags = (body.tags && body.tags.length > 0 ? body.tags : body.tag_names) ?? [];
  const tagRows = await resolveTags(rawTags);
  await setPostTags(post.id, tagRows);

  const category = post.category_id
    ? (await db.select().from(categories).where(eq(categories.id, post.category_id)).limit(1))[0] ??
      null
    : null;

  return c.json(
    toPostDetail(post, {
      author: me,
      category,
      tags: tagRows,
      userReaction: null,
      isBookmarked: false,
      breakdown: { ...EMPTY_BREAKDOWN },
    }),
    201,
  );
});

postRoutes.get('/', optionalAuth, async (c) => {
  const me = c.get('currentUser');
  const q = c.req.query();

  const limitRaw = Number(q.limit ?? 10);
  const limit = Math.min(50, Math.max(1, Number.isFinite(limitRaw) ? Math.trunc(limitRaw) : 10));
  const authorId = q.author_id ? asUuid(q.author_id) : null;
  const conditions = [eq(posts.is_published, true)];

  const isAdminOrMod = !!me && (me.role === 'admin' || me.role === 'moderator');
  const isAuthorQuery = !!authorId && !!me && me.id === authorId;

  if (isAuthorQuery || isAdminOrMod) {
    const wanted = q.status?.toLowerCase();
    if (wanted && wanted !== 'all') {
      if (wanted === 'pending' || wanted === 'approved' || wanted === 'rejected') {
        conditions.push(eq(posts.status, wanted));
      }
    } else if (!isAuthorQuery && !q.status) {
      conditions.push(eq(posts.status, 'approved'));
    }
  } else {
    conditions.push(eq(posts.status, 'approved'));
  }

  if (q.category) {
    const catId = asUuid(q.category);
    let resolved: string | null = catId;
    if (!resolved) {
      const cat = await db
        .select({ id: categories.id })
        .from(categories)
        .where(or(eq(categories.slug, q.category), ilike(categories.name, q.category)))
        .limit(1);
      resolved = cat[0]?.id ?? null;
    }
    // A parent category shows its children's posts too.
    conditions.push(resolved ? categoryScope(resolved) : sql`false`);
  }

  if (q.tag) {
    const tagRow = await db
      .select({ id: tags.id })
      .from(tags)
      .where(or(eq(tags.slug, q.tag), ilike(tags.name, q.tag)))
      .limit(1);
    if (tagRow[0]) {
      conditions.push(
        sql`exists (select 1 from ${postTags} where ${postTags.post_id} = ${posts.id} and ${postTags.tag_id} = ${tagRow[0].id})`,
      );
    } else {
      conditions.push(sql`false`);
    }
  }

  if (q.post_type) {
    const t = q.post_type.toLowerCase();
    if (t === 'article' || t === 'question' || t === 'review' || t === 'share') {
      conditions.push(eq(posts.post_type, t));
    }
  }

  if (authorId) {
    conditions.push(eq(posts.author_id, authorId));
    // Lọc theo tác giả mà vẫn trả bài ẩn danh thì chính bộ lọc là chỗ rò rỉ:
    // người đọc chỉ cần gọi ?author_id=<id> là nối được bài ẩn danh với tên
    // người viết, dù phần hiển thị đã giấu tên. Chỉ chính chủ và ban quản trị
    // mới thấy bài ẩn danh của một tài khoản.
    if (!isAuthorQuery && !isAdminOrMod) {
      conditions.push(eq(posts.is_anonymous, false));
    }
  }

  if (q.search && q.search.trim()) {
    // search_text is stored lowercase and diacritic-free, so "tieu duong"
    // matches "tiểu đường". Falls back to title/content for rows written
    // before the column existed and not yet edited.
    const needle = `%${deaccent(q.search.trim()).toLowerCase()}%`;
    const raw = `%${q.search.trim()}%`;
    conditions.push(
      or(ilike(posts.search_text, needle), ilike(posts.title, raw), ilike(posts.content, raw))!,
    );
  }

  // Keyset pagination: strictly older than the cursor, tie-broken by id.
  if (q.cursor) {
    const decoded = decodeCursor(q.cursor);
    if (decoded) {
      conditions.push(
        or(
          lt(posts.created_at, decoded.t),
          and(eq(posts.created_at, decoded.t), lt(posts.id, decoded.id)),
        )!,
      );
    }
  }

  const order =
    q.sort_by === 'popular'
      ? [desc(posts.helpful_count), desc(posts.created_at), desc(posts.id)]
      : [desc(posts.created_at), desc(posts.id)];

  const rows = await db
    .select({ post: posts, author: users, category: categories })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.author_id))
    .leftJoin(categories, eq(categories.id, posts.category_id))
    .where(and(...conditions))
    .orderBy(...order)
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const ids = page.map((r) => r.post.id);

  const [tagsByPost, breakdowns, viewer] = await Promise.all([
    loadTagsForPosts(ids),
    loadReactionBreakdowns(ids),
    loadViewerState(ids, me?.id ?? null),
  ]);

  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? encodeCursor(last.post.created_at, last.post.id) : null;

  return c.json({
    items: page.map((r) =>
      toPostSummary(r.post, {
        author: r.author,
        category: r.category,
        tags: tagsByPost.get(r.post.id) ?? [],
        userReaction: viewer.reactions.get(r.post.id) ?? null,
        breakdown: breakdowns.get(r.post.id),
        isBookmarked: viewer.bookmarks.has(r.post.id),
        viewerId: me?.id ?? null,
        viewerIsStaff: isAdminOrMod,
      }),
    ),
    next_cursor: nextCursor,
    has_more: hasMore,
    limit,
    total: null,
  });
});

postRoutes.get('/:id_or_slug', optionalAuth, async (c) => {
  const me = c.get('currentUser');
  const key = c.req.param('id_or_slug');
  const id = asUuid(key);

  const found = await loadPostByIdOrSlug(id ?? key, !!id);
  if (!found) throw notFound('Post not found');

  // A pending or rejected post is visible only to its author and to staff;
  // everyone else gets the same 404 as a post that does not exist, so the
  // queue cannot be probed.
  if (found.post.status !== 'approved') {
    const isAuthor = !!me && me.id === found.post.author_id;
    const isStaff = !!me && (me.role === 'admin' || me.role === 'moderator');
    if (!isAuthor && !isStaff) throw notFound('Post not found');
  }

  const bumped = await db
    .update(posts)
    .set({ view_count: sql`${posts.view_count} + 1` })
    .where(eq(posts.id, found.post.id))
    .returning();
  const post = bumped[0] ?? found.post;

  const [breakdown, tagsByPost, viewer] = await Promise.all([
    getReactionBreakdown(post.id),
    loadTagsForPosts([post.id]),
    loadViewerState([post.id], me?.id ?? null),
  ]);

  return c.json(
    toPostDetail(post, {
      author: found.author,
      category: found.category,
      tags: tagsByPost.get(post.id) ?? [],
      userReaction: viewer.reactions.get(post.id) ?? null,
      isBookmarked: viewer.bookmarks.has(post.id),
      viewerId: me?.id ?? null,
      viewerIsStaff: !!me && (me.role === 'admin' || me.role === 'moderator'),
      breakdown,
    }),
  );
});

postRoutes.put('/:id_or_slug', requireAuth, async (c) => {
  const me = currentUser(c);
  const key = c.req.param('id_or_slug');
  const id = asUuid(key);

  const found = await loadPostByIdOrSlug(id ?? key, !!id);
  if (!found) throw notFound('Post not found');

  const isAuthor = found.post.author_id === me.id;
  const isStaff = me.role === 'admin' || me.role === 'moderator';
  if (!isAuthor && !isStaff) {
    throw forbidden('Not enough permissions to edit this post');
  }

  const body = await parseBody(c, postUpdateSchema);
  const patch: Partial<typeof posts.$inferInsert> = {};

  if (body.title !== undefined && body.title !== null && body.title !== found.post.title) {
    patch.title = sanitizePlainText(body.title);
    patch.slug = await generateUniqueSlug(patch.title, found.post.id);
  }

  if (body.content !== undefined && body.content !== null) {
    patch.content = sanitizeRichText(body.content);
    if (body.excerpt === undefined || body.excerpt === null) {
      patch.excerpt = stripHtmlAndTruncate(patch.content);
    }
  }
  if (body.excerpt !== undefined && body.excerpt !== null) {
    patch.excerpt = sanitizePlainText(body.excerpt);
  }
  if (body.thumbnail !== undefined && body.thumbnail !== null) {
    patch.thumbnail = body.thumbnail;
  }
  if (body.post_type !== undefined && body.post_type !== null) {
    patch.post_type = body.post_type;
  }
  if (body.category_id !== undefined && body.category_id !== null) {
    const cat = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.id, body.category_id))
      .limit(1);
    if (cat.length === 0) throw notFound('Category not found');
    patch.category_id = body.category_id;
  }

  // Any edit to the searchable fields rewrites the haystack.
  if (patch.title !== undefined || patch.content !== undefined || patch.excerpt !== undefined) {
    patch.search_text = toSearchText(
      patch.title ?? found.post.title,
      patch.excerpt ?? found.post.excerpt,
      patch.content ?? found.post.content,
    );
  }

  const updatedRows = await db
    .update(posts)
    .set({ ...patch, updated_at: new Date() })
    .where(eq(posts.id, found.post.id))
    .returning();
  const post = updatedRows[0] ?? found.post;

  // Mirrors `raw_tags = post_in.tags or post_in.tag_names` followed by
  // `if raw_tags is not None`. An empty `tags` array falls through to
  // tag_names, and when that is absent the post's tags are left alone —
  // treating [] as "remove every tag" would silently strip them on any
  // edit that does not resend the list.
  const rawTags =
    body.tags && body.tags.length > 0
      ? body.tags
      : body.tag_names !== undefined && body.tag_names !== null
        ? body.tag_names
        : null;
  if (rawTags !== null) {
    await setPostTags(post.id, await resolveTags(rawTags));
  }

  const category = post.category_id
    ? (await db.select().from(categories).where(eq(categories.id, post.category_id)).limit(1))[0] ??
      null
    : null;

  const [breakdown, tagsByPost] = await Promise.all([
    getReactionBreakdown(post.id),
    loadTagsForPosts([post.id]),
  ]);

  return c.json(
    toPostDetail(post, {
      author: found.author,
      category,
      tags: tagsByPost.get(post.id) ?? [],
      userReaction: null,
      isBookmarked: false,
      viewerId: me.id,
      viewerIsStaff: isStaff,
      breakdown,
    }),
  );
});

/**
 * Marks one comment as the accepted answer. PostType.QUESTION already
 * existed but behaved exactly like an article; this is what makes the forum
 * a question-and-answer site. Only the post's author (or staff) decides.
 * Sending comment_id: null clears the selection.
 */
postRoutes.put('/:id_or_slug/accepted-answer', requireAuth, async (c) => {
  const me = currentUser(c);
  const key = c.req.param('id_or_slug');
  const id = asUuid(key);

  const rows = await db
    .select()
    .from(posts)
    .where(id ? eq(posts.id, id) : eq(posts.slug, key))
    .limit(1);
  const post = rows[0];
  if (!post) throw notFound('Post not found');

  const isStaff = me.role === 'admin' || me.role === 'moderator';
  if (post.author_id !== me.id && !isStaff) {
    throw forbidden('Chỉ tác giả bài viết mới chọn được câu trả lời');
  }

  const body = await parseBody(c, acceptAnswerSchema);

  if (body.comment_id !== null) {
    const comment = await db
      .select({ id: comments.id, post_id: comments.post_id, is_deleted: comments.is_deleted })
      .from(comments)
      .where(eq(comments.id, body.comment_id))
      .limit(1);
    if (!comment[0] || comment[0].post_id !== post.id) {
      throw notFound('Comment not found on this post');
    }
    if (comment[0].is_deleted) {
      throw badRequest('Không thể chọn một bình luận đã bị xóa');
    }
  }

  await db
    .update(posts)
    .set({ accepted_comment_id: body.comment_id, updated_at: new Date() })
    .where(eq(posts.id, post.id));

  return c.json({ success: true, accepted_comment_id: body.comment_id });
});

postRoutes.delete('/:id_or_slug', requireAuth, async (c) => {
  const me = currentUser(c);
  const key = c.req.param('id_or_slug');
  const id = asUuid(key);

  const rows = await db
    .select()
    .from(posts)
    .where(id ? eq(posts.id, id) : eq(posts.slug, key))
    .limit(1);
  const post = rows[0];
  if (!post) throw notFound('Post not found');

  const isAuthor = post.author_id === me.id;
  const isStaff = me.role === 'admin' || me.role === 'moderator';
  if (!isAuthor && !isStaff) {
    throw forbidden('Not enough permissions to delete this post');
  }

  await db.delete(posts).where(eq(posts.id, post.id));
  return c.body(null, 204);
});

