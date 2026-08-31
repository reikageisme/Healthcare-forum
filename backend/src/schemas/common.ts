import { z } from 'zod';

export const uuidSchema = z.string().uuid();

export const postTypeValues = ['article', 'question', 'review', 'share'] as const;
export const postStatusValues = ['pending', 'approved', 'rejected'] as const;
export const reactionTypeValues = ['helpful', 'like', 'informative'] as const;
export const reportStatusValues = ['open', 'resolved', 'dismissed'] as const;
export const reportTargetValues = ['post', 'comment', 'user'] as const;
export const userRoleValues = ['guest', 'user', 'doctor', 'moderator', 'admin'] as const;

/**
 * The Python schemas ran a `mode="before"` validator that lowercased enum
 * input, so the API accepted "APPROVED" as well as "approved". Preserved
 * here so existing callers keep working.
 */
export function caseInsensitiveEnum<T extends readonly [string, ...string[]]>(values: T) {
  return z.preprocess(
    (v) => (typeof v === 'string' ? v.toLowerCase() : v),
    z.enum(values),
  ) as z.ZodType<T[number]>;
}

export const postTypeInput = caseInsensitiveEnum(postTypeValues);
export const postStatusInput = caseInsensitiveEnum(postStatusValues);
export const reactionTypeInput = caseInsensitiveEnum(reactionTypeValues);
export const reportStatusInput = caseInsensitiveEnum(reportStatusValues);
export const reportTargetInput = caseInsensitiveEnum(reportTargetValues);
export const userRoleInput = caseInsensitiveEnum(userRoleValues);
