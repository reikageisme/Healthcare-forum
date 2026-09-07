import { and, eq, sql, type SQL } from 'drizzle-orm';
import { posts, type PostRow, type UserRow } from '../db/schema.js';
import { conflict, notFound, unauthorized } from '../core/errors.js';

/** Only pass viewers loaded by optionalAuth/requireAuth, never client-supplied roles. */
export type PostViewer = Pick<UserRow, 'id' | 'role'> | null;
export type PostAccess = 'read' | 'interact';
type PostVisibility = Pick<PostRow, 'author_id' | 'status' | 'is_published'>;

function isStaff(viewer: PostViewer): boolean {
  return viewer?.role === 'admin' || viewer?.role === 'moderator';
}

export function isPublicPost(post: PostVisibility): boolean {
  return post.status === 'approved' && post.is_published;
}

export function canReadPost(post: PostVisibility, viewer: PostViewer): boolean {
  return isPublicPost(post) || viewer?.id === post.author_id || isStaff(viewer);
}

export function canInteractWithPost(post: PostVisibility, viewer: PostViewer): boolean {
  return !!viewer && isPublicPost(post);
}

/**
 * Hidden posts are indistinguishable from missing ones to unrelated readers.
 * Authors and staff can inspect/edit them, but new comments/replies and
 * reaction/bookmark toggles are community actions and require a public post.
 * Editorial ownership and moderation permissions stay in their route handlers.
 */
export function requirePostAccess(post: PostVisibility, viewer: PostViewer, access: PostAccess): void {
  if (access === 'interact' && !viewer) throw unauthorized('Not authenticated');
  if (!canReadPost(post, viewer)) throw notFound('Post not found');
  if (access === 'interact' && !canInteractWithPost(post, viewer)) {
    throw conflict('Post is not open for community interactions');
  }
}

/** Apply in SQL before pagination, including on the bookmark feed for owner/staff. */
export function publicPostCondition(): SQL {
  return and(eq(posts.status, 'approved'), eq(posts.is_published, true))!;
}

/**
 * The ordinary feed is public for everyone. Private listings must be an
 * author's own author_id query or an explicit, recognised staff status query.
 * Invalid status values cannot accidentally turn the staff feed into "all".
 */
export function postListAccessCondition(
  viewer: PostViewer,
  authorId: string | null,
  requestedStatus?: string,
): SQL {
  const wanted = requestedStatus?.toLowerCase();
  const hasStatus = wanted === 'pending' || wanted === 'approved' || wanted === 'rejected';

  if (viewer && authorId === viewer.id) {
    const ownPosts = eq(posts.author_id, viewer.id);
    return hasStatus ? and(ownPosts, eq(posts.status, wanted))! : ownPosts;
  }

  if (isStaff(viewer)) {
    if (hasStatus) return eq(posts.status, wanted);
    if (wanted === 'all') return sql`true`;
  }

  return publicPostCondition();
}
