import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { posts, type PostRow } from '../db/schema.js';
import { notFound } from '../core/errors.js';
import { asUuid } from '../core/security.js';

/** The find_post() helper duplicated across comments, reactions and bookmarks. */
export async function findPostOr404(idOrSlug: string): Promise<PostRow> {
  const id = asUuid(idOrSlug);
  const rows = await db
    .select()
    .from(posts)
    .where(id ? eq(posts.id, id) : eq(posts.slug, idOrSlug))
    .limit(1);
  const post = rows[0];
  if (!post) throw notFound('Post not found');
  return post;
}
