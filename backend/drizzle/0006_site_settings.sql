-- Cấu hình trang do quản trị viên sửa được, thay cho biến môi trường.
--
-- Một bảng khoá/giá trị JSON thay vì mỗi thứ một bảng: mạng lưới, liên kết
-- chân trang và email liên hệ đều là "một mẩu cấu hình toàn site", không phải
-- ba thực thể khác nhau. Ba bảng với ba API CRUD cho ba mẩu này là công sức bỏ
-- ra không đổi lấy được gì.
--
-- Idempotent, chạy mỗi lần khởi động như các bản vá khác.

CREATE TABLE IF NOT EXISTS "site_settings" (
  "key" varchar(64) PRIMARY KEY,
  "value" jsonb NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
