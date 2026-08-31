-- Vietnamese forum features. Idempotent: runs on every boot.

-- 1. Accent-insensitive search.
-- search_text holds a lowercase, diacritic-free copy of title + excerpt +
-- content, written by the application so no Postgres extension is required.
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "search_text" text;
--> statement-breakpoint

-- 1b. Spam triage. Higher score = reviewed first.
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "risk_score" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint

-- 2. Accepted answer, for PostType.QUESTION.
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "accepted_comment_id" uuid;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'posts_accepted_comment_id_comments_id_fk'
  ) THEN
    ALTER TABLE "posts"
      ADD CONSTRAINT "posts_accepted_comment_id_comments_id_fk"
      FOREIGN KEY ("accepted_comment_id") REFERENCES "public"."comments"("id")
      ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint

-- 3. Anonymous posting. Health questions people will not ask under their
-- own name are the ones most worth asking.
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "is_anonymous" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "is_anonymous" boolean DEFAULT false NOT NULL;
--> statement-breakpoint

-- 4. Licence-verified doctors. verified_at being set is what earns the badge;
-- an admin flipping the role does not.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "verified_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "workplace" varchar(255);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verificationstatus') THEN
    CREATE TYPE "public"."verificationstatus" AS ENUM('pending', 'approved', 'rejected');
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "doctor_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"license_number" varchar(100) NOT NULL,
	"specialty" varchar(100),
	"workplace" varchar(255),
	"document_url" varchar(500) NOT NULL,
	"status" "verificationstatus" DEFAULT 'pending' NOT NULL,
	"review_notes" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'doctor_verifications_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "doctor_verifications"
      ADD CONSTRAINT "doctor_verifications_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'doctor_verifications_reviewed_by_users_id_fk'
  ) THEN
    ALTER TABLE "doctor_verifications"
      ADD CONSTRAINT "doctor_verifications_reviewed_by_users_id_fk"
      FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id")
      ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_doctor_verifications_user_id" ON "doctor_verifications" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_doctor_verifications_status" ON "doctor_verifications" USING btree ("status");
