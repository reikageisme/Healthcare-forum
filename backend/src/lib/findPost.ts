import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { posts, type PostRow } from '../db/schema.js';
import { notFound } from '../core/errors.js';
import { asUuid } from '../core/security.js';
import { requirePostAccess, type PostAccess, type PostViewer } from './postAccess.js';

/** A UUID/slug lookup must explicitly choose read or community-interaction access. */
export async function findPostOr404(
  idOrSlug: string,
  viewer: PostViewer,
  access: PostAccess,
): Promise<PostRow> {
  const id = asUuid(idOrSlug);
  const rows = await db
    .select()
    .from(posts)
    .where(id ? eq(posts.id, id) : eq(posts.slug, idOrSlug))
    .limit(1);
  const post = rows[0];
  if (!post) throw notFound('Post not found');
  requirePostAccess(post, viewer, access);
  return post;
}
