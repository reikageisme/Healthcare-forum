-- Thông báo cho người dùng.
--
-- Chuông ở header trước giờ chỉ là một cái icon: bấm vào không có gì xảy ra.
-- Bảng này là thứ đứng sau nó — ai bình luận bài của bạn, ai trả lời bình
-- luận của bạn, bài của bạn được duyệt hay bị từ chối.
--
-- Không lưu nội dung sinh ra từ dữ liệu khác (tên tác giả, tiêu đề bài) dưới
-- dạng khoá ngoại rồi join lại lúc đọc: câu chữ của một thông báo là ảnh chụp
-- tại thời điểm nó xảy ra. Bài đổi tên về sau thì thông báo cũ vẫn phải kể
-- đúng chuyện đã xảy ra hôm đó.
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Người gây ra thông báo. NULL khi là hệ thống (bài được duyệt).
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  type varchar(32) NOT NULL,
  title varchar(255) NOT NULL,
  body varchar(500),
  -- Đường dẫn tương đối trong chính trang, ví dụ /posts/<id>#comments.
  link varchar(500),
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
-- Truy vấn duy nhất chạy nhiều: "thông báo mới nhất của tôi" và "còn mấy cái
-- chưa đọc". Một chỉ số phủ đúng cả hai.
CREATE INDEX IF NOT EXISTS ix_notifications_user_created
  ON notifications (user_id, created_at DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ix_notifications_user_unread
  ON notifications (user_id, is_read);
