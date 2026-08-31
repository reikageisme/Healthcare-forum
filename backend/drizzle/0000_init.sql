CREATE TYPE "public"."poststatus" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."posttype" AS ENUM('article', 'question', 'review', 'share');--> statement-breakpoint
CREATE TYPE "public"."reactiontype" AS ENUM('helpful', 'like', 'informative');--> statement-breakpoint
CREATE TYPE "public"."reportstatus" AS ENUM('open', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."reporttargettype" AS ENUM('post', 'comment', 'user');--> statement-breakpoint
CREATE TYPE "public"."userrole" AS ENUM('guest', 'user', 'doctor', 'moderator', 'admin');--> statement-breakpoint
CREATE TABLE "bookmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"post_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_user_post_bookmark" UNIQUE("user_id","post_id")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"icon" varchar(100),
	"description" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"parent_id" uuid,
	"author_id" uuid NOT NULL,
	"content" text NOT NULL,
	"vote_count" integer DEFAULT 0 NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_tags" (
	"post_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "post_tags_post_id_tag_id_pk" PRIMARY KEY("post_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"excerpt" varchar(500),
	"thumbnail" varchar(500),
	"post_type" "posttype" DEFAULT 'article' NOT NULL,
	"status" "poststatus" DEFAULT 'approved' NOT NULL,
	"rejection_reason" varchar(500),
	"view_count" integer DEFAULT 0 NOT NULL,
	"helpful_count" integer DEFAULT 0 NOT NULL,
	"comment_count" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"author_id" uuid NOT NULL,
	"category_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"post_id" uuid NOT NULL,
	"reaction_type" "reactiontype" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_user_post_reaction" UNIQUE("user_id","post_id")
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid NOT NULL,
	"target_type" "reporttargettype" NOT NULL,
	"target_id" uuid NOT NULL,
	"report_type" varchar(50) DEFAULT 'spam' NOT NULL,
	"reason" varchar(255) NOT NULL,
	"details" text,
	"status" "reportstatus" DEFAULT 'open' NOT NULL,
	"resolution_notes" text,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(50) NOT NULL,
	"slug" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"hashed_password" text NOT NULL,
	"full_name" text,
	"avatar_url" text,
	"specialty" varchar(100),
	"bio" varchar(500),
	"role" "userrole" DEFAULT 'user' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_tags" ADD CONSTRAINT "post_tags_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_tags" ADD CONSTRAINT "post_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_bookmarks_user_id" ON "bookmarks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ix_bookmarks_post_id" ON "bookmarks" USING btree ("post_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ix_categories_name" ON "categories" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "ix_categories_slug" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "ix_comments_post_id" ON "comments" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "ix_comments_parent_id" ON "comments" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "ix_comments_author_id" ON "comments" USING btree ("author_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ix_posts_slug" ON "posts" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "ix_posts_author_id" ON "posts" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "ix_posts_category_id" ON "posts" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "ix_posts_created_at" ON "posts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ix_posts_post_type" ON "posts" USING btree ("post_type");--> statement-breakpoint
CREATE INDEX "ix_posts_status" ON "posts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ix_reactions_user_id" ON "reactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ix_reactions_post_id" ON "reactions" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "ix_reports_reporter_id" ON "reports" USING btree ("reporter_id");--> statement-breakpoint
CREATE INDEX "ix_reports_target_type" ON "reports" USING btree ("target_type");--> statement-breakpoint
CREATE INDEX "ix_reports_target_id" ON "reports" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "ix_reports_status" ON "reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ix_reports_created_at" ON "reports" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ix_tags_name" ON "tags" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "ix_tags_slug" ON "tags" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "ix_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "ix_users_username" ON "users" USING btree ("username");
