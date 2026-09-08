-- Đăng nhập bằng Google.
--
-- google_sub là định danh ổn định Google cấp cho mỗi tài khoản ("sub" trong
-- id_token). Khớp theo cột này chứ không theo email: người dùng đổi được địa
-- chỉ Gmail của họ, sub thì không bao giờ đổi.
--
-- Chỉ số UNIQUE cho phép nhiều NULL trong Postgres, nên hàng chục nghìn tài
-- khoản đăng ký bằng mật khẩu vẫn nằm yên với google_sub rỗng.
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub varchar(64);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ix_users_google_sub ON users (google_sub);
--> statement-breakpoint
-- Tài khoản tạo từ Google không có mật khẩu nào để lưu. Cột vẫn NOT NULL vì
-- mọi hàng cũ đều có giá trị; hàng mới nhận một chuỗi băm ngẫu nhiên không
-- khớp với bất kỳ mật khẩu nào, nên "đăng nhập bằng mật khẩu" của tài khoản
-- Google luôn thất bại — đúng như mong muốn.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;
