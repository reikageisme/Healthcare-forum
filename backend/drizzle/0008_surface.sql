-- Tách diễn đàn khỏi trang tin.
--
-- Trước đây một mã nguồn, một bảng posts, một cây chuyên mục phục vụ cả hai
-- trang, nên medicvn.com và forums.medicvn.com hiện y hệt nhau — chỉ khác cái
-- khung. "surface" là nhãn nói bài này (hay chuyên mục này) thuộc về bên nào.
--
-- Mặc định 'forum': toàn bộ nội dung đang có sinh ra từ diễn đàn, phần nào
-- đáng đưa sang trang tin thì khối DO bên dưới chuyển một lần.
ALTER TABLE posts ADD COLUMN IF NOT EXISTS surface varchar(16) NOT NULL DEFAULT 'forum';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ix_posts_surface ON posts (surface);
--> statement-breakpoint
ALTER TABLE categories ADD COLUMN IF NOT EXISTS surface varchar(16) NOT NULL DEFAULT 'forum';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ix_categories_surface ON categories (surface);
--> statement-breakpoint

-- Ba việc CHỈ ĐƯỢC LÀM MỘT LẦN.
--
-- migrate.ts chạy lại mọi file vá ở mỗi lần khởi động, nên nếu để trần thì
-- mỗi lần restart lại kéo bài về 'portal' và ghi đè tên chuyên mục admin vừa
-- sửa. Một hàng đánh dấu trong site_settings là cách rẻ nhất để nói "xong rồi".
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM site_settings WHERE key = 'surface_split_2026_09') THEN
    RETURN;
  END IF;

  -- 1. Tên chuyên mục dính dấu gạch: "Cấp cứu-hồi sức-gây mê" đọc như một lỗi
  --    gõ. Thêm khoảng trắng quanh dấu gạch và viết hoa đầu mỗi vế. Slug giữ
  --    nguyên nên không link nào gãy.
  UPDATE categories c
  SET name = normalized.value
  FROM (
    SELECT
      id,
      (
        SELECT string_agg(upper(left(part, 1)) || substr(part, 2), ' - ' ORDER BY ord)
        FROM unnest(regexp_split_to_array(name, '\s*-\s*')) WITH ORDINALITY AS t(part, ord)
        WHERE part <> ''
      ) AS value
    FROM categories
    WHERE name LIKE '%-%'
  ) AS normalized
  WHERE c.id = normalized.id
    AND normalized.value IS NOT NULL
    AND normalized.value <> c.name
    -- Đổi tên thành một tên đã có thì bỏ qua hàng đó, còn hơn để cả migration
    -- gãy vì chỉ số UNIQUE trên name.
    AND NOT EXISTS (SELECT 1 FROM categories other WHERE other.name = normalized.value);

  -- 2. Bài cũ về đúng bên. Bài dạng ARTICLE do admin/mod/bác sĩ đăng chính là
  --    nội dung toà soạn — đưa sang trang tin. Hỏi đáp, chia sẻ, đánh giá và
  --    mọi bài của thành viên thường ở lại diễn đàn.
  UPDATE posts p
  SET surface = 'portal'
  FROM users u
  WHERE u.id = p.author_id
    AND p.post_type = 'article'
    AND u.role IN ('admin', 'moderator', 'doctor');

  -- 3. Cây chuyên khoa (Nội, Ngoại, Sản - Phụ - Nhi...) ở lại diễn đàn — đó là
  --    cách một diễn đàn y khoa chia box. Trang tin cần một cây riêng, ngắn,
  --    theo kiểu một toà soạn xếp chuyên trang.
  --
  --    Chỉ gieo khi trang tin chưa có chuyên mục nào: nếu không, admin xoá một
  --    mục là lần khởi động sau nó mọc lại.
  IF NOT EXISTS (SELECT 1 FROM categories WHERE surface = 'portal') THEN
    INSERT INTO categories (name, slug, icon, description, surface, sort_order)
    VALUES
      ('Tin y tế', 'tin-y-te', '📰', 'Tin tức ngành y, bệnh viện, nhân lực y tế', 'portal', 1),
      ('Cảnh báo dịch bệnh', 'canh-bao-dich-benh', '⚠️', 'Diễn biến dịch, khuyến cáo phòng chống', 'portal', 2),
      ('Cẩm nang sức khỏe', 'cam-nang-suc-khoe', '📖', 'Hướng dẫn chăm sóc sức khỏe thường ngày', 'portal', 3),
      ('Chính sách - Bảo hiểm y tế', 'chinh-sach-bao-hiem-y-te', '📋', 'Quy định, thông tư, quyền lợi BHYT', 'portal', 4),
      ('Nghiên cứu - Công nghệ y tế', 'nghien-cuu-cong-nghe-y-te', '🔬', 'Nghiên cứu mới, thiết bị và công nghệ', 'portal', 5)
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO site_settings (key, value) VALUES ('surface_split_2026_09', 'true'::jsonb)
  ON CONFLICT (key) DO NOTHING;
END $$;
