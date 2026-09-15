-- Tìm kiếm và ghi nguồn nội dung.
--
-- Mọi file trong thư mục này được chạy lại mỗi lần container khởi động, nên
-- từng câu lệnh phải an toàn khi chạy nhiều lần.

-- pg_trgm cho phép Postgres dùng chỉ mục với ILIKE '%...%'. Không có nó thì
-- mỗi lần tìm kiếm là một lần quét toàn bộ bảng posts.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ix_posts_search_text_trgm ON posts USING gin (search_text gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ix_posts_title_trgm ON posts USING gin (title gin_trgm_ops);
--> statement-breakpoint

-- Nội dung này từ đâu ra, và đã có ai chịu trách nhiệm chuyên môn chưa.
ALTER TABLE posts ADD COLUMN IF NOT EXISTS content_source varchar(120);
--> statement-breakpoint
ALTER TABLE posts ADD COLUMN IF NOT EXISTS source_url varchar(500);
--> statement-breakpoint
ALTER TABLE posts ADD COLUMN IF NOT EXISTS review_status varchar(24) NOT NULL DEFAULT 'none';
--> statement-breakpoint
ALTER TABLE posts ADD COLUMN IF NOT EXISTS reviewed_by_id uuid;
--> statement-breakpoint
ALTER TABLE posts ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
--> statement-breakpoint

-- Khóa ngoại thêm rời để câu ALTER ở trên vẫn chạy được trên database đã có
-- cột nhưng chưa có ràng buộc.
DO $do$
BEGIN
  ALTER TABLE posts
    ADD CONSTRAINT posts_reviewed_by_id_fkey
    FOREIGN KEY (reviewed_by_id) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END
$do$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ix_posts_review_status ON posts (review_status);
