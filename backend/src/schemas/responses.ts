import { z } from 'zod';
import type { CategoryRow, CommentRow, PostRow, ReportRow, TagRow, UserRow } from '../db/schema.js';
import { toIso, toIsoRequired } from '../lib/datetime.js';
import { postImages } from '../lib/postImages.js';
import {
  postStatusValues,
  postTypeValues,
  reportStatusValues,
  reportTargetValues,
  userRoleValues,
} from './common.js';

/**
 * FastAPI used `response_model=` to filter every response before it was
 * serialised — that filtering, not the handlers, is what kept
 * `hashed_password` out of GET /users/{id} (users.py:18 returns the ORM row
 * directly). Hono has no equivalent, so every response is built field by
 * field here and validated by Zod, which strips anything unlisted.
 *
 * Rule for this file: never spread a database row into a response object.
 */

export const userResponseSchema = z
  .object({
    email: z.string(),
    username: z.string(),
    full_name: z.string().nullable(),
    avatar_url: z.string().nullable(),
    specialty: z.string().nullable(),
    bio: z.string().nullable(),
    id: z.string(),
    role: z.enum(userRoleValues),
    workplace: z.string().nullable(),
    /** Non-null only for a doctor whose practising licence was approved. */
    verified_at: z.string().nullable(),
    is_active: z.boolean(),
    created_at: z.string(),
    post_count: z.number().int(),
    comment_count: z.number().int(),
  })
  .strict();
export type UserResponse = z.infer<typeof userResponseSchema>;

/**
 * Stand-in author for anonymous content. No real id, so nothing about the
 * poster travels to other readers — the point of the feature.
 */
export const ANONYMOUS_AUTHOR: UserResponse = Object.freeze({
  email: '',
  username: 'an-danh',
  full_name: 'Người dùng ẩn danh',
  avatar_url: null,
  specialty: null,
  bio: null,
  id: 'anonymous',
  role: 'user' as const,
  workplace: null,
  verified_at: null,
  is_active: true,
  created_at: new Date(0).toISOString().replace('Z', '+00:00'),
  post_count: 0,
  comment_count: 0,
});

export function toUserResponse(
  user: UserRow,
  counts?: { post_count?: number; comment_count?: number },
): UserResponse {
  return userResponseSchema.parse({
    email: user.email,
    username: user.username,
    full_name: user.full_name,
    avatar_url: user.avatar_url,
    specialty: user.specialty,
    bio: user.bio,
    id: user.id,
    role: user.role,
    workplace: user.workplace,
    verified_at: toIso(user.verified_at),
    is_active: user.is_active,
    created_at: toIsoRequired(user.created_at),
    post_count: counts?.post_count ?? 0,
    comment_count: counts?.comment_count ?? 0,
  });
}

export const categoryResponseSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    icon: z.string().nullable(),
    description: z.string().nullable(),
    parent_id: z.string().nullable(),
    sort_order: z.number().int(),
    created_at: z.string(),
    post_count: z.number().int(),
  })
  .strict();
export type CategoryResponse = z.infer<typeof categoryResponseSchema>;

export function toCategoryResponse(row: CategoryRow, postCount = 0): CategoryResponse {
  return categoryResponseSchema.parse({
    id: row.id,
    name: row.name,
    slug: row.slug,
    icon: row.icon,
    description: row.description,
    parent_id: row.parent_id,
    sort_order: row.sort_order ?? 0,
    created_at: toIsoRequired(row.created_at),
    post_count: postCount,
  });
}

export const tagResponseSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    created_at: z.string(),
  })
  .strict();
export type TagResponse = z.infer<typeof tagResponseSchema>;

export function toTagResponse(row: TagRow): TagResponse {
  return tagResponseSchema.parse({
    id: row.id,
    name: row.name,
    slug: row.slug,
    created_at: toIsoRequired(row.created_at),
  });
}

export const tagWithCountSchema = tagResponseSchema
  .extend({ post_count: z.number().int() })
  .strict();
export type TagWithCount = z.infer<typeof tagWithCountSchema>;

export function toTagWithCount(row: TagRow, postCount = 0): TagWithCount {
  return tagWithCountSchema.parse({ ...toTagResponse(row), post_count: postCount });
}

export const reactionCountsSchema = z
  .object({
    helpful: z.number().int(),
    like: z.number().int(),
    informative: z.number().int(),
    total: z.number().int(),
  })
  .strict();
export type ReactionCounts = z.infer<typeof reactionCountsSchema>;

export const postSummarySchema = z
  .object({
    id: z.string(),
    title: z.string(),
    slug: z.string(),
    excerpt: z.string().nullable(),
    thumbnail: z.string().nullable(),
    // Ảnh rút từ nội dung bài, để feed dựng lưới ảnh nhiều tấm.
    images: z.array(z.string()).default([]),
    post_type: z.enum(postTypeValues),
    status: z.enum(postStatusValues),
    rejection_reason: z.string().nullable(),
    is_anonymous: z.boolean(),
    accepted_comment_id: z.string().nullable(),
    view_count: z.number().int(),
    helpful_count: z.number().int(),
    comment_count: z.number().int(),
    is_published: z.boolean(),
    created_at: z.string(),
    updated_at: z.string(),
    author: userResponseSchema,
    category: categoryResponseSchema.nullable(),
    tags: z.array(tagResponseSchema),
    user_reaction: z.string().nullable(),
    reaction_breakdown: reactionCountsSchema,
    is_bookmarked: z.boolean(),
  })
  .strict();
export type PostSummaryResponse = z.infer<typeof postSummarySchema>;

export const postDetailSchema = postSummarySchema
  .extend({
    content: z.string(),
  })
  .strict();
export type PostDetailResponse = z.infer<typeof postDetailSchema>;

export interface PostViewContext {
  author: UserRow;
  category?: CategoryRow | null;
  tags?: TagRow[];
  userReaction?: string | null;
  /** Số lượt thả cảm xúc; ai đọc cũng thấy, kể cả khách chưa đăng nhập. */
  breakdown?: ReactionCounts;
  isBookmarked?: boolean;
  /** Who is reading. The author and staff still see the real name. */
  viewerId?: string | null;
  viewerIsStaff?: boolean;
}

/** Anonymous content shows a placeholder to everyone except its author and staff. */
function authorFor(
  isAnonymous: boolean,
  author: UserRow,
  viewerId?: string | null,
  viewerIsStaff?: boolean,
): UserResponse {
  if (!isAnonymous) return toUserResponse(author);
  if (viewerIsStaff || (viewerId && viewerId === author.id)) return toUserResponse(author);
  return ANONYMOUS_AUTHOR;
}

/**
 * The single builder replacing the six hand-written PostSummaryResponse(...)
 * blocks in admin.py, posts.py and bookmarks.py — each of which listed the
 * same twenty fields by hand.
 */
export function toPostSummary(post: PostRow, ctx: PostViewContext): PostSummaryResponse {
  return postSummarySchema.parse({
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    thumbnail: post.thumbnail,
    images: postImages(post.content, post.thumbnail),
    post_type: post.post_type,
    status: post.status,
    rejection_reason: post.rejection_reason,
    is_anonymous: post.is_anonymous,
    accepted_comment_id: post.accepted_comment_id,
    view_count: post.view_count,
    helpful_count: post.helpful_count,
    comment_count: post.comment_count,
    is_published: post.is_published,
    created_at: toIsoRequired(post.created_at),
    updated_at: toIsoRequired(post.updated_at),
    author: authorFor(post.is_anonymous, ctx.author, ctx.viewerId, ctx.viewerIsStaff),
    category: ctx.category ? toCategoryResponse(ctx.category) : null,
    tags: (ctx.tags ?? []).map(toTagResponse),
    user_reaction: ctx.userReaction ?? null,
    reaction_breakdown: ctx.breakdown ?? { helpful: 0, like: 0, informative: 0, total: 0 },
    is_bookmarked: ctx.isBookmarked ?? false,
  });
}

export function toPostDetail(
  post: PostRow,
  ctx: PostViewContext & { breakdown: ReactionCounts },
): PostDetailResponse {
  return postDetailSchema.parse({
    ...toPostSummary(post, ctx),
    content: post.content,
  });
}

export interface CommentResponse {
  id: string;
  post_id: string;
  parent_id: string | null;
  content: string;
  vote_count: number;
  is_anonymous: boolean;
  is_accepted: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  author: UserResponse | null;
  replies: CommentResponse[];
}

export const commentResponseSchema: z.ZodType<CommentResponse> = z.lazy(() =>
  z
    .object({
      id: z.string(),
      post_id: z.string(),
      parent_id: z.string().nullable(),
      content: z.string(),
      vote_count: z.number().int(),
      is_anonymous: z.boolean(),
      is_accepted: z.boolean(),
      is_deleted: z.boolean(),
      created_at: z.string(),
      updated_at: z.string(),
      author: userResponseSchema.nullable(),
      replies: z.array(commentResponseSchema),
    })
    .strict(),
);

export function toCommentResponse(
  row: CommentRow,
  author: UserRow | null,
  replies: CommentResponse[] = [],
  opts: { acceptedCommentId?: string | null; viewerId?: string | null; viewerIsStaff?: boolean } = {},
): CommentResponse {
  return commentResponseSchema.parse({
    id: row.id,
    post_id: row.post_id,
    parent_id: row.parent_id,
    content: row.content,
    vote_count: row.vote_count,
    is_anonymous: row.is_anonymous,
    is_accepted: opts.acceptedCommentId === row.id,
    is_deleted: row.is_deleted,
    created_at: toIsoRequired(row.created_at),
    updated_at: toIsoRequired(row.updated_at),
    author: author
      ? authorFor(row.is_anonymous, author, opts.viewerId, opts.viewerIsStaff)
      : null,
    replies,
  });
}

export const reportResponseSchema = z
  .object({
    id: z.string(),
    reporter_id: z.string(),
    target_type: z.enum(reportTargetValues),
    target_id: z.string(),
    report_type: z.string().nullable(),
    reason: z.string(),
    details: z.string().nullable(),
    status: z.enum(reportStatusValues),
    resolution_notes: z.string().nullable(),
    resolved_by: z.string().nullable(),
    resolved_at: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
    reporter: userResponseSchema.nullable(),
    resolver: userResponseSchema.nullable(),
    target_title: z.string().nullable(),
    target_author_name: z.string().nullable(),
  })
  .strict();
export type ReportResponse = z.infer<typeof reportResponseSchema>;

export function toReportResponse(
  row: ReportRow,
  extra: {
    reporter?: UserRow | null;
    resolver?: UserRow | null;
    target_title?: string | null;
    target_author_name?: string | null;
  } = {},
): ReportResponse {
  return reportResponseSchema.parse({
    id: row.id,
    reporter_id: row.reporter_id,
    target_type: row.target_type,
    target_id: row.target_id,
    report_type: row.report_type,
    reason: row.reason,
    details: row.details,
    status: row.status,
    resolution_notes: row.resolution_notes,
    resolved_by: row.resolved_by,
    resolved_at: toIso(row.resolved_at),
    created_at: toIsoRequired(row.created_at),
    updated_at: toIsoRequired(row.updated_at),
    reporter: extra.reporter ? toUserResponse(extra.reporter) : null,
    resolver: extra.resolver ? toUserResponse(extra.resolver) : null,
    target_title: extra.target_title ?? null,
    target_author_name: extra.target_author_name ?? null,
  });
}

export const tokenResponseSchema = z
  .object({
    access_token: z.string(),
    refresh_token: z.string(),
    token_type: z.literal('bearer'),
  })
  .strict();

export const uploadResponseSchema = z
  .object({
    url: z.string(),
    filename: z.string(),
    content_type: z.string(),
    size: z.number().int(),
  })
  .strict();
