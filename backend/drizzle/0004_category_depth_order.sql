-- Chuyên mục: thêm thứ tự sắp xếp thủ công.
-- Cây chuyên mục nới từ hai lên ba cấp — thay đổi đó nằm ở tầng API, không
-- có ràng buộc nào trong lược đồ cần sửa. Idempotent, chạy mỗi lần khởi động.

ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_categories_sort_order" ON "categories" ("sort_order");
