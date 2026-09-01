import { randomUUID } from 'node:crypto';
import { and, eq, inArray, ne, or, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  bookmarks,
  categories,
  postTags,
  posts,
  reactions,
  tags,
  users,
  type CategoryRow,
  type PostRow,
  type TagRow,
  type UserRow,
} from '../db/schema.js';
import { slugify } from './slugify.js';
import { toIso } from './datetime.js';
import type { ReactionCounts } from '../schemas/responses.js';

/**
 * Cursor format is base64(JSON{t,id}) with URL-safe characters and the
 * padding Python's urlsafe_b64encode emits. Anything already held by an open
 * browser tab has to keep decoding across the cutover.
 */
export function encodeCursor(createdAt: Date, postId: string): string {
  const payload = JSON.stringify({ t: toIso(createdAt), id: postId });
  return Buffer.from(payload, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export function decodeCursor(cursor: string): { t: Date; id: string } | null {
  try {
    const normalised = cursor.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(Buffer.from(normalised, 'base64').toString('utf8'));
    const t = new Date(payload.t);
    if (Number.isNaN(t.getTime()) || typeof payload.id !== 'string') return null;
    return { t, id: payload.id };
  } catch {
    return null;
  }
}

export async function generateUniqueSlug(
  title: string,
  excludePostId?: string,
): Promise<string> {
  const base = slugify(title) || 'post';
  let candidate = base;

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const where = excludePostId
      ? and(eq(posts.slug, candidate), ne(posts.id, excludePostId))
      : eq(posts.slug, candidate);
    const clash = await db.select({ id: posts.id }).from(posts).where(where).limit(1);
    if (clash.length === 0) return candidate;
    candidate = `${base}-${randomUUID().replace(/-/g, '').slice(0, 6)}`;
  }
  return `${base}-${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

/**
 * Một thẻ gõ vào dưới dạng slug ("phong-kham") được trả lại thành chữ
 * thường có dấu cách. Người dùng hay dán slug từ URL vào ô thẻ, và
 * "#phong-kham" hiện trên trang thì vừa xấu vừa khó gõ lại.
 *
 * Chỉ đụng tới chuỗi thuần chữ thường ASCII nối bằng gạch: "COVID-19",
 * "SARS-CoV-2" hay thẻ có dấu tiếng Việt đều giữ nguyên.
 */
export function humanizeTagName(raw: string): string {
  const name = raw.trim();
  if (!/^[a-z]+(-[a-z]+)+$/.test(name)) return name;
  const spaced = name.replace(/-/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Finds tags by slug or case-insensitive name, creating the missing ones. */
export async function resolveTags(rawNames: string[]): Promise<TagRow[]> {
  const resolved: TagRow[] = [];
  const seen = new Set<string>();

  for (const raw of rawNames) {
    const name = humanizeTagName(raw);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());

    const tagSlug = slugify(name) || name.toLowerCase();
    const found = await db
      .select()
      .from(tags)
      .where(or(eq(tags.slug, tagSlug), sql`lower(${tags.name}) = lower(${name})`))
      .limit(1);

    const existing = found[0];
    if (existing) {
      // "Phòng khám" và "phong-kham" cùng trỏ về một thẻ: lọc trùng theo id
      // của thẻ tìm được, không chỉ theo chữ người dùng gõ.
      if (!resolved.some((t) => t.id === existing.id)) resolved.push(existing);
      continue;
    }
    const inserted = await db
      .insert(tags)
      .values({ name, slug: tagSlug })
      .onConflictDoNothing()
      .returning();
    if (inserted[0]) {
      resolved.push(inserted[0]);
    } else {
      // Lost a race against a concurrent insert — read the winner back.
      const again = await db.select().from(tags).where(eq(tags.slug, tagSlug)).limit(1);
      if (again[0]) resolved.push(again[0]);
    }
  }
  return resolved;
}

export async function setPostTags(postId: string, tagRows: TagRow[]): Promise<void> {
  await db.delete(postTags).where(eq(postTags.post_id, postId));
  if (tagRows.length === 0) return;
  await db
    .insert(postTags)
    .values(tagRows.map((t) => ({ post_id: postId, tag_id: t.id })))
    .onConflictDoNothing();
}

export async function getReactionBreakdown(postId: string): Promise<ReactionCounts> {
  const rows = await db
    .select({ reaction_type: reactions.reaction_type, n: sql<number>`count(*)::int` })
    .from(reactions)
    .where(eq(reactions.post_id, postId))
    .groupBy(reactions.reaction_type);

  const breakdown: ReactionCounts = { helpful: 0, like: 0, informative: 0, total: 0 };
  for (const row of rows) {
    const n = Number(row.n);
    breakdown[row.reaction_type] = n;
    breakdown.total += n;
  }
  return breakdown;
}

/**
 * One query per collection rather than one per post — the batched IN (...)
 * lookups that kept the Python list endpoints free of N+1.
 */
export async function loadTagsForPosts(postIds: string[]): Promise<Map<string, TagRow[]>> {
  const byPost = new Map<string, TagRow[]>();
  if (postIds.length === 0) return byPost;

  const rows = await db
    .select({ post_id: postTags.post_id, tag: tags })
    .from(postTags)
    .innerJoin(tags, eq(tags.id, postTags.tag_id))
    .where(inArray(postTags.post_id, postIds));

  for (const row of rows) {
    const list = byPost.get(row.post_id) ?? [];
    list.push(row.tag);
    byPost.set(row.post_id, list);
  }
  return byPost;
}

export interface ViewerState {
  reactions: Map<string, string>;
  bookmarks: Set<string>;
}

export async function loadViewerState(
  postIds: string[],
  userId: string | null,
): Promise<ViewerState> {
  const state: ViewerState = { reactions: new Map(), bookmarks: new Set() };
  if (!userId || postIds.length === 0) return state;

  const [rx, bm] = await Promise.all([
    db
      .select({ post_id: reactions.post_id, reaction_type: reactions.reaction_type })
      .from(reactions)
      .where(and(eq(reactions.user_id, userId), inArray(reactions.post_id, postIds))),
    db
      .select({ post_id: bookmarks.post_id })
      .from(bookmarks)
      .where(and(eq(bookmarks.user_id, userId), inArray(bookmarks.post_id, postIds))),
  ]);

  for (const r of rx) state.reactions.set(r.post_id, r.reaction_type);
  for (const b of bm) state.bookmarks.add(b.post_id);
  return state;
}

export interface PostWithRelations {
  post: PostRow;
  author: UserRow;
  category: CategoryRow | null;
}

export async function loadPostByIdOrSlug(
  key: string,
  isUuid: boolean,
): Promise<PostWithRelations | null> {
  const rows = await db
    .select({ post: posts, author: users, category: categories })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.author_id))
    .leftJoin(categories, eq(categories.id, posts.category_id))
    .where(isUuid ? eq(posts.id, key) : eq(posts.slug, key))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  return { post: row.post, author: row.author, category: row.category };
}
