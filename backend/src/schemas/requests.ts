import { z } from 'zod';
import {
  postStatusInput,
  postTypeInput,
  reactionTypeInput,
  reportStatusInput,
  reportTargetInput,
  userRoleInput,
} from './common.js';

const optionalString = (max: number) => z.string().max(max).nullish();

export const userCreateSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(50),
  password: z.string().min(8, 'Mật khẩu phải có ít nhất 8 ký tự').max(128),
  full_name: optionalString(255),
  avatar_url: optionalString(500),
  specialty: optionalString(100),
  bio: optionalString(500),
});

export const userLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({ refresh_token: z.string().min(1) });

export const userUpdateSchema = z.object({
  full_name: optionalString(255),
  avatar_url: optionalString(500),
  specialty: optionalString(100),
  bio: optionalString(500),
});

export const userRoleUpdateSchema = z.object({ role: userRoleInput });
export const userStatusUpdateSchema = z.object({ is_active: z.boolean() });
export const adminUserUpdateSchema = z.object({
  role: userRoleInput.optional(),
  is_active: z.boolean().optional(),
  specialty: optionalString(100),
  bio: optionalString(500),
});

export const postCreateSchema = z.object({
  title: z.string().min(3).max(255),
  content: z.string().min(5),
  excerpt: optionalString(500),
  thumbnail: optionalString(500),
  post_type: postTypeInput.optional().default('article'),
  category_id: z.string().uuid().nullish(),
  tags: z.array(z.string()).optional().default([]),
  tag_names: z.array(z.string()).nullish(),
});

export const postUpdateSchema = z.object({
  title: z.string().min(3).max(255).optional(),
  content: z.string().min(5).optional(),
  excerpt: optionalString(500),
  thumbnail: optionalString(500),
  post_type: postTypeInput.optional(),
  category_id: z.string().uuid().nullish(),
  tags: z.array(z.string()).nullish(),
  tag_names: z.array(z.string()).nullish(),
});

export const postModerationSchema = z.object({
  status: postStatusInput,
  rejection_reason: optionalString(500),
  reason: optionalString(500),
});

export const postRejectSchema = z.object({ reason: optionalString(500) });

export const categoryCreateSchema = z.object({
  name: z.string().min(1).max(100),
  slug: optionalString(100),
  icon: optionalString(100),
  description: optionalString(255),
  parent_id: z.string().uuid().nullish(),
});

export const categoryUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: optionalString(100),
  icon: optionalString(100),
  description: optionalString(255),
  // Explicit null detaches the category from its parent, so this field
  // distinguishes "not sent" from "sent as null".
  parent_id: z.string().uuid().nullish(),
});

export const commentCreateSchema = z.object({
  content: z.string().min(1),
  parent_id: z.string().uuid().nullish(),
});

export const commentUpdateSchema = z.object({ content: z.string().min(1) });

export const reactionCreateSchema = z.object({ reaction_type: reactionTypeInput });

export const reportCreateSchema = z.object({
  target_type: reportTargetInput,
  target_id: z.string().uuid(),
  report_type: optionalString(50),
  reason: z.string().min(1).max(255),
  details: z.string().max(5000).nullish(),
});

export const reportUpdateSchema = z.object({
  status: reportStatusInput,
  resolution_notes: z.string().max(5000).nullish(),
});
