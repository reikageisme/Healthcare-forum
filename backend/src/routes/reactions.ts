import { Hono } from 'hono';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { posts, reactions } from '../db/schema.js';
import { parseBody } from '../lib/validate.js';
import { findPostOr404 } from '../lib/findPost.js';
import { getReactionBreakdown } from '../lib/postQueries.js';
import { reactionCreateSchema } from '../schemas/requests.js';
import { currentUser, optionalAuth, requireAuth } from '../middleware/auth.js';

export const reactionRoutes = new Hono();

reactionRoutes.post('/posts/:post_id/reactions', requireAuth, async (c) => {
  const me = currentUser(c);
  const post = await findPostOr404(c.req.param('post_id'));
  const body = await parseBody(c, reactionCreateSchema);

  const existingRows = await db
    .select()
    .from(reactions)
    .where(and(eq(reactions.user_id, me.id), eq(reactions.post_id, post.id)))
    .limit(1);
  const existing = existingRows[0];

  let action: 'added' | 'removed' | 'updated';
  let currentReaction: string | null;

  if (!existing) {
    await db
      .insert(reactions)
      .values({ user_id: me.id, post_id: post.id, reaction_type: body.reaction_type })
      .onConflictDoUpdate({
        target: [reactions.user_id, reactions.post_id],
        set: { reaction_type: body.reaction_type },
      });
    action = 'added';
    currentReaction = body.reaction_type;
  } else if (existing.reaction_type === body.reaction_type) {
    await db.delete(reactions).where(eq(reactions.id, existing.id));
    action = 'removed';
    currentReaction = null;
  } else {
    await db
      .update(reactions)
      .set({ reaction_type: body.reaction_type })
      .where(eq(reactions.id, existing.id));
    action = 'updated';
    currentReaction = body.reaction_type;
  }

  const counts = await getReactionBreakdown(post.id);
  // helpful_count on the post mirrors the "helpful" tally only.
  await db.update(posts).set({ helpful_count: counts.helpful }).where(eq(posts.id, post.id));

  return c.json({ success: true, action, current_reaction: currentReaction, counts });
});

reactionRoutes.get('/posts/:post_id/reactions', optionalAuth, async (c) => {
  const me = c.get('currentUser');
  const post = await findPostOr404(c.req.param('post_id'));
  const counts = await getReactionBreakdown(post.id);

  let userReaction: string | null = null;
  if (me) {
    const rows = await db
      .select({ reaction_type: reactions.reaction_type })
      .from(reactions)
      .where(and(eq(reactions.user_id, me.id), eq(reactions.post_id, post.id)))
      .limit(1);
    userReaction = rows[0]?.reaction_type ?? null;
  }

  return c.json({ counts, user_reaction: userReaction });
});
