-- Adds the parent/child tree to categories.
-- Written to be safe both on a database that already ran the Alembic
-- migrations and on a freshly created one, so it can run on every boot.
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "parent_id" uuid;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'categories_parent_id_categories_id_fk'
  ) THEN
    ALTER TABLE "categories"
      ADD CONSTRAINT "categories_parent_id_categories_id_fk"
      FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id")
      ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_categories_parent_id" ON "categories" USING btree ("parent_id");
