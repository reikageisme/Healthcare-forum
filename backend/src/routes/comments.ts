import { Hono } from 'hono';
import { asc, count, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { comments, posts, users } from '../db/schema.js';
import { badRequest, forbidden, notFound } from '../core/errors.js';
import { asUuid } from '../core/security.js';
import { parseBody } from '../lib/validate.js';
import { findPostOr404 } from '../lib/findPost.js';
import { sanitizeRichText } from '../lib/sanitize.js';
import { commentCreateSchema, commentUpdateSchema } from '../schemas/requests.js';
import { toCommentResponse, type CommentResponse } from '../schemas/responses.js';
import { currentUser, optionalAuth, requireAuth } from '../middleware/auth.js';

export const commentRoutes = new Hono();

const TOMBSTONE = '[Bình luận đã bị xóa]';

commentRoutes.post('/posts/:post_id/comments', requireAuth, async (c) => {
  const me = currentUser(c);
  const post = await findPostOr404(c.req.param('post_id'));
  const body = await parseBody(c, commentCreateSchema);

  if (body.parent_id) {
    const parent = await db
      .select({ id: comments.id, post_id: comments.post_id })
      .from(comments)
      .where(eq(comments.id, body.parent_id))
      .limit(1);
    if (!parent[0]) throw notFound('Parent comment not found');
    if (parent[0].post_id !== post.id) {
      throw badRequest('Parent comment belongs to a different post');
    }
  }

  // Comment bodies are rendered as HTML too, so they go through the same
  // allowlist as post content.
  const inserted = await db
    .insert(comments)
    .values({
      post_id: post.id,
      parent_id: body.parent_id ?? null,
      author_id: me.id,
      is_anonymous: body.is_anonymous ?? false,
      content: sanitizeRichText(body.content),
    })
    .returning();
  const comment = inserted[0];
  if (!comment) throw badRequest('Could not create comment');

  await db
    .update(posts)
    .set({ comment_count: sql`${posts.comment_count} + 1` })
    .where(eq(posts.id, post.id));

  return c.json(toCommentResponse(comment, me, [], { viewerId: me.id }), 201);
});

commentRoutes.get('/posts/:post_id/comments', optionalAuth, async (c) => {
  const me = c.get('currentUser');
  const post = await findPostOr404(c.req.param('post_id'));
  const sortBy = c.req.query('sort_by') ?? 'newest';
  const viewer = {
    acceptedCommentId: post.accepted_comment_id,
    viewerId: me?.id ?? null,
    viewerIsStaff: !!me && (me.role === 'admin' || me.role === 'moderator'),
  };

  // One query for the whole thread; the tree is assembled in memory.
  const rows = await db
    .select({ comment: comments, author: users })
    .from(comments)
    .leftJoin(users, eq(users.id, comments.author_id))
    .where(eq(comments.post_id, post.id))
    .orderBy(asc(comments.created_at));

  const nodes = new Map<string, CommentResponse>();
  for (const row of rows) {
    const node = toCommentResponse(
      {
        ...row.comment,
        content: row.comment.is_deleted ? TOMBSTONE : row.comment.content,
      },
      row.author,
      [],
      viewer,
    );
    nodes.set(row.comment.id, node);
  }

  const roots: CommentResponse[] = [];
  for (const row of rows) {
    const node = nodes.get(row.comment.id);
    if (!node) continue;
    const parentId = row.comment.parent_id;
    const parent = parentId ? nodes.get(parentId) : undefined;
    if (parent) parent.replies.push(node);
    else roots.push(node);
  }

  if (sortBy === 'newest') {
    roots.sort((a, b) => b.created_at.localeCompare(a.created_at));
  } else if (sortBy === 'popular') {
    roots.sort((a, b) => b.vote_count - a.vote_count);
  }
  // "oldest" is already the query order.

  // The accepted answer goes to the top whatever the sort, which is the
  // whole point of marking one.
  roots.sort((a, b) => Number(b.is_accepted) - Number(a.is_accepted));

  return c.json(roots);
});

commentRoutes.put('/comments/:comment_id', requireAuth, async (c) => {
  const me = currentUser(c);
  const id = asUuid(c.req.param('comment_id'));
  if (!id) throw notFound('Comment not found');

  const rows = await db
    .select({ comment: comments, author: users })
    .from(comments)
    .leftJoin(users, eq(users.id, comments.author_id))
    .where(eq(comments.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) throw notFound('Comment not found');

  const isAuthor = row.comment.author_id === me.id;
  const isStaff = me.role === 'admin' || me.role === 'moderator';
  if (!isAuthor && !isStaff) {
    throw forbidden('Not enough permissions to edit this comment');
  }
  if (row.comment.is_deleted) throw badRequest('Cannot edit a deleted comment');

  const body = await parseBody(c, commentUpdateSchema);
  const updated = await db
    .update(comments)
    .set({ content: sanitizeRichText(body.content), updated_at: new Date() })
    .where(eq(comments.id, id))
    .returning();
  const comment = updated[0];
  if (!comment) throw notFound('Comment not found');

  return c.json(
    toCommentResponse(comment, row.author, [], { viewerId: me.id, viewerIsStaff: isStaff }),
  );
});

commentRoutes.delete('/comments/:comment_id', requireAuth, async (c) => {
  const me = currentUser(c);
  const id = asUuid(c.req.param('comment_id'));
  if (!id) throw notFound('Comment not found');

  const rows = await db.select().from(comments).where(eq(comments.id, id)).limit(1);
  const comment = rows[0];
  if (!comment) throw notFound('Comment not found');

  const isAuthor = comment.author_id === me.id;
  const isStaff = me.role === 'admin' || me.role === 'moderator';
  if (!isAuthor && !isStaff) {
    throw forbidden('Not enough permissions to delete this comment');
  }

  const replies = await db
    .select({ n: count() })
    .from(comments)
    .where(eq(comments.parent_id, comment.id));
  const hasReplies = Number(replies[0]?.n ?? 0) > 0;

  await db
    .update(posts)
    .set({ comment_count: sql`greatest(${posts.comment_count} - 1, 0)` })
    .where(eq(posts.id, comment.post_id));

  if (hasReplies) {
    // Tombstone, so the replies underneath keep their place in the thread.
    await db
      .update(comments)
      .set({ is_deleted: true, content: TOMBSTONE, updated_at: new Date() })
      .where(eq(comments.id, comment.id));
  } else {
    await db.delete(comments).where(eq(comments.id, comment.id));
  }

  return c.body(null, 204);
});
