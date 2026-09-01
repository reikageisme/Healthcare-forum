import {
  boolean,
  index,
  uniqueIndex,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

/**
 * Enum labels are lowercase in Postgres because the Alembic migrations
 * created them that way (0001/0002). The Python side needed enum_column()
 * to stop SQLAlchemy persisting member *names*; here the labels are simply
 * written out as they exist in the database.
 *
 * `guest` is unused anywhere in backend or frontend, but the label stays in
 * the database type — removing a label from a live enum is not worth it.
 */
export const userRoleEnum = pgEnum('userrole', [
  'guest',
  'user',
  'doctor',
  'moderator',
  'admin',
]);
export const postTypeEnum = pgEnum('posttype', ['article', 'question', 'review', 'share']);
export const postStatusEnum = pgEnum('poststatus', ['pending', 'approved', 'rejected']);
export const reactionTypeEnum = pgEnum('reactiontype', ['helpful', 'like', 'informative']);
export const reportStatusEnum = pgEnum('reportstatus', ['open', 'resolved', 'dismissed']);
export const reportTargetTypeEnum = pgEnum('reporttargettype', [
  'post',
  'comment',
  'user',
  'story',
]);
export const verificationStatusEnum = pgEnum('verificationstatus', [
  'pending',
  'approved',
  'rejected',
]);

/** Unique indexes below mirror op.create_index(..., unique=True) in 0001. */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    username: text('username').notNull(),
    hashed_password: text('hashed_password').notNull(),
    full_name: text('full_name'),
    avatar_url: text('avatar_url'),
    specialty: varchar('specialty', { length: 100 }),
    bio: varchar('bio', { length: 500 }),
    role: userRoleEnum('role').notNull().default('user'),
    // Set only when a practising licence has been reviewed and approved.
    // An admin changing the role does not earn the badge.
    verified_at: timestamp('verified_at', { withTimezone: true }),
    workplace: varchar('workplace', { length: 255 }),
    is_active: boolean('is_active').notNull().default(true),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailIdx: uniqueIndex('ix_users_email').on(t.email),
    usernameIdx: uniqueIndex('ix_users_username').on(t.username),
  }),
);

export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 100 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull(),
    icon: varchar('icon', { length: 100 }),
    description: varchar('description', { length: 255 }),
    // Self-reference for the parent/child tree. Depth is capped at two
    // levels by the API: a category that has a parent cannot become one.
    parent_id: uuid('parent_id'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    parentIdx: index('ix_categories_parent_id').on(t.parent_id),
    nameIdx: uniqueIndex('ix_categories_name').on(t.name),
    slugIdx: uniqueIndex('ix_categories_slug').on(t.slug),
  }),
);

export const tags = pgTable(
  'tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 50 }).notNull(),
    slug: varchar('slug', { length: 50 }).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    nameIdx: uniqueIndex('ix_tags_name').on(t.name),
    slugIdx: uniqueIndex('ix_tags_slug').on(t.slug),
  }),
);

export const posts = pgTable(
  'posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: varchar('title', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull(),
    content: text('content').notNull(),
    excerpt: varchar('excerpt', { length: 500 }),
    thumbnail: varchar('thumbnail', { length: 500 }),
    post_type: postTypeEnum('post_type').notNull().default('article'),
    status: postStatusEnum('status').notNull().default('approved'),
    rejection_reason: varchar('rejection_reason', { length: 500 }),
    // Lowercase, diacritic-free copy of title + excerpt + content.
    search_text: text('search_text'),
    // Only meaningful for post_type = 'question'.
    accepted_comment_id: uuid('accepted_comment_id'),
    is_anonymous: boolean('is_anonymous').notNull().default(false),
    /** Supplement-spam heuristic score; the queue is sorted by it. */
    risk_score: integer('risk_score').notNull().default(0),
    view_count: integer('view_count').notNull().default(0),
    helpful_count: integer('helpful_count').notNull().default(0),
    comment_count: integer('comment_count').notNull().default(0),
    is_published: boolean('is_published').notNull().default(true),
    author_id: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    category_id: uuid('category_id').references(() => categories.id, {
      onDelete: 'set null',
    }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    slugIdx: uniqueIndex('ix_posts_slug').on(t.slug),
    authorIdx: index('ix_posts_author_id').on(t.author_id),
    categoryIdx: index('ix_posts_category_id').on(t.category_id),
    createdIdx: index('ix_posts_created_at').on(t.created_at),
    typeIdx: index('ix_posts_post_type').on(t.post_type),
    statusIdx: index('ix_posts_status').on(t.status),
  }),
);

export const postTags = pgTable(
  'post_tags',
  {
    post_id: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    tag_id: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.post_id, t.tag_id] }),
  }),
);

export const comments = pgTable(
  'comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    post_id: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    parent_id: uuid('parent_id'),
    author_id: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    vote_count: integer('vote_count').notNull().default(0),
    is_anonymous: boolean('is_anonymous').notNull().default(false),
    is_deleted: boolean('is_deleted').notNull().default(false),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    postIdx: index('ix_comments_post_id').on(t.post_id),
    parentIdx: index('ix_comments_parent_id').on(t.parent_id),
    authorIdx: index('ix_comments_author_id').on(t.author_id),
  }),
);

export const reactions = pgTable(
  'reactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    post_id: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    reaction_type: reactionTypeEnum('reaction_type').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uq: unique('uq_user_post_reaction').on(t.user_id, t.post_id),
    userIdx: index('ix_reactions_user_id').on(t.user_id),
    postIdx: index('ix_reactions_post_id').on(t.post_id),
  }),
);

export const bookmarks = pgTable(
  'bookmarks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    post_id: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uq: unique('uq_user_post_bookmark').on(t.user_id, t.post_id),
    userIdx: index('ix_bookmarks_user_id').on(t.user_id),
    postIdx: index('ix_bookmarks_post_id').on(t.post_id),
  }),
);

export const reports = pgTable(
  'reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reporter_id: uuid('reporter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    target_type: reportTargetTypeEnum('target_type').notNull(),
    target_id: uuid('target_id').notNull(),
    report_type: varchar('report_type', { length: 50 }).notNull().default('spam'),
    reason: varchar('reason', { length: 255 }).notNull(),
    details: text('details'),
    status: reportStatusEnum('status').notNull().default('open'),
    resolution_notes: text('resolution_notes'),
    resolved_by: uuid('resolved_by').references(() => users.id, { onDelete: 'set null' }),
    resolved_at: timestamp('resolved_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    reporterIdx: index('ix_reports_reporter_id').on(t.reporter_id),
    targetTypeIdx: index('ix_reports_target_type').on(t.target_type),
    targetIdIdx: index('ix_reports_target_id').on(t.target_id),
    statusIdx: index('ix_reports_status').on(t.status),
    createdIdx: index('ix_reports_created_at').on(t.created_at),
  }),
);

export const doctorVerifications = pgTable(
  'doctor_verifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    full_name: varchar('full_name', { length: 255 }).notNull(),
    license_number: varchar('license_number', { length: 100 }).notNull(),
    specialty: varchar('specialty', { length: 100 }),
    workplace: varchar('workplace', { length: 255 }),
    /** Image of the practising licence, from POST /upload. */
    document_url: varchar('document_url', { length: 500 }).notNull(),
    status: verificationStatusEnum('status').notNull().default('pending'),
    review_notes: text('review_notes'),
    reviewed_by: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    reviewed_at: timestamp('reviewed_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('ix_doctor_verifications_user_id').on(t.user_id),
    statusIdx: index('ix_doctor_verifications_status').on(t.status),
  }),
);

export const stories = pgTable(
  'stories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    author_id: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Always a path under /uploads, produced by POST /upload. */
    image_url: varchar('image_url', { length: 500 }).notNull(),
    caption: varchar('caption', { length: 280 }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    /**
     * Reads filter on this rather than a job deleting rows, so a story stops
     * being served the moment it expires whether or not any cleanup ran.
     * ponytail: rows accumulate; add a nightly DELETE when the table gets big.
     */
    expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    authorIdx: index('ix_stories_author_id').on(t.author_id),
    expiresIdx: index('ix_stories_expires_at').on(t.expires_at),
  }),
);

export const storiesRelations = relations(stories, ({ one }) => ({
  author: one(users, { fields: [stories.author_id], references: [users.id] }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
  comments: many(comments),
  reactions: many(reactions),
  bookmarks: many(bookmarks),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  posts: many(posts),
  parent: one(categories, {
    fields: [categories.parent_id],
    references: [categories.id],
    relationName: 'category_parent',
  }),
  children: many(categories, { relationName: 'category_parent' }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  postTags: many(postTags),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(users, { fields: [posts.author_id], references: [users.id] }),
  category: one(categories, { fields: [posts.category_id], references: [categories.id] }),
  postTags: many(postTags),
  comments: many(comments),
  reactions: many(reactions),
  bookmarks: many(bookmarks),
}));

export const postTagsRelations = relations(postTags, ({ one }) => ({
  post: one(posts, { fields: [postTags.post_id], references: [posts.id] }),
  tag: one(tags, { fields: [postTags.tag_id], references: [tags.id] }),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  post: one(posts, { fields: [comments.post_id], references: [posts.id] }),
  author: one(users, { fields: [comments.author_id], references: [users.id] }),
}));

export const reactionsRelations = relations(reactions, ({ one }) => ({
  user: one(users, { fields: [reactions.user_id], references: [users.id] }),
  post: one(posts, { fields: [reactions.post_id], references: [posts.id] }),
}));

export const bookmarksRelations = relations(bookmarks, ({ one }) => ({
  user: one(users, { fields: [bookmarks.user_id], references: [users.id] }),
  post: one(posts, { fields: [bookmarks.post_id], references: [posts.id] }),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  reporter: one(users, { fields: [reports.reporter_id], references: [users.id] }),
  resolver: one(users, { fields: [reports.resolved_by], references: [users.id] }),
}));

export type UserRow = typeof users.$inferSelect;
export type PostRow = typeof posts.$inferSelect;
export type CommentRow = typeof comments.$inferSelect;
export type CategoryRow = typeof categories.$inferSelect;
export type TagRow = typeof tags.$inferSelect;
export type ReportRow = typeof reports.$inferSelect;
export type DoctorVerificationRow = typeof doctorVerifications.$inferSelect;
export type StoryRow = typeof stories.$inferSelect;
