-- Stories: an image plus a short caption that stops being served after 24h.
-- Idempotent, runs on every boot.

-- Reports already cover posts, comments and users; a story nobody can report
-- would be the one place on the forum with no way to flag abuse.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'reporttargettype' AND e.enumlabel = 'story'
  ) THEN
    ALTER TYPE "public"."reporttargettype" ADD VALUE 'story';
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" uuid NOT NULL,
	"image_url" varchar(500) NOT NULL,
	"caption" varchar(280),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stories_author_id_users_id_fk'
  ) THEN
    ALTER TABLE "stories"
      ADD CONSTRAINT "stories_author_id_users_id_fk"
      FOREIGN KEY ("author_id") REFERENCES "public"."users"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_stories_author_id" ON "stories" USING btree ("author_id");
--> statement-breakpoint
-- Every read filters on expires_at, so it carries the index.
CREATE INDEX IF NOT EXISTS "ix_stories_expires_at" ON "stories" USING btree ("expires_at");
