# Đề xuất hướng phát triển — Healthcare Forum

Ngày: 2026-09-03. Người soạn: Claude (theo yêu cầu của Tanh).
Cơ sở: đọc `backend/src`, `frontend/src`, `docs/plans/2026-08-30-gitnexus-plan-healthcare-forum-hardening.md`.

Phần pháp lý ở mục 4 là tóm tắt từ nguồn công khai để biết mà tra tiếp, không
phải tư vấn pháp lý.

---

## 0. Hiện trạng gọn

Đã có và chạy được: auth (access + refresh, RBAC 4 vai), bài viết
(pending/approved/rejected, slug, ảnh, TipTap), bình luận phân cấp + chấp nhận
câu trả lời, reaction, bookmark, tag, category cây, story hết hạn 24h, báo cáo
vi phạm, xác minh bác sĩ, admin portal + biểu đồ, upload ảnh qua sharp,
sanitize HTML, rate limit in-process, sitemap, 101 test Vitest chạy trên PGlite.

Đây là một forum hoàn chỉnh về mặt CRUD. Cái thiếu không nằm ở tính năng cơ
bản nữa mà ở ba chỗ: **vòng lặp giữ chân người dùng**, **khả năng vận hành /
điều tra**, và **đặc thù ngành y tế**.

---

## 1. Nợ đã biết, chưa đóng (làm trước, rẻ nhất)

Lấy thẳng từ bảng gate trong plan hardening — vẫn còn mở tại HEAD:

| Gate | Việc | Vì sao đáng làm ngay |
|---|---|---|
| G4 | `findPostOr404` mới kiểm tra tồn tại, chưa kiểm tra visibility; comment/reaction/bookmark đi vòng qua nó | Bài `approved` nhưng `is_published = false` vẫn xem được chi tiết — rò rỉ nội dung chưa công bố |
| G6 | `tags.ts` đếm `post_tags.post_id` sau outer join | Số bài trên tag sai, chính README đang ghi nhận là sai |
| G7 | `AdminReportsPage` xoá nội dung rồi resolve bằng 2 request | Backend đã có API nguyên tử `deleteReportContent(reportId)`; frontend chưa dùng → mất đồng bộ khi request thứ 2 lỗi |
| G3 | `authStore` chỉ giữ access token, `lib/api.ts` logout ngay ở 401 đầu tiên | Người dùng bị đá ra sau 15 phút dù có refresh token |
| G8 | Không có lockfile frontend, ESLint không chạy, bundle > 500 kB | Build không lặp lại được |
| G11 | Không có `.github/workflows` | Lỗi `/admin/stats` vừa rồi là loại lỗi mà một job `npm test` bắt được ngay |

Ngoài bảng đó, thêm ba chỗ tôi thấy khi đọc:

- `PROJECT.md` vẫn mô tả kiến trúc FastAPI + SQLAlchemy + Alembic. Codebase là
  Hono + Drizzle từ lâu rồi. Tài liệu sai còn hại hơn không có tài liệu.
- `git status` đang bẩn 12 file chỉ vì CRLF↔LF. Đặt `core.autocrlf` +
  `.gitattributes` một lần cho xong.
- Chưa có route quên/đặt lại mật khẩu. Người dùng mất mật khẩu là mất tài khoản.

---

## 2. Vận hành & quan sát (hợp với việc vừa dựng SOC)

**2.1 Log có cấu trúc + request id.** Hiện tại lỗi ra bằng
`console.error('[unhandled]', err)` — đúng như log SOC vừa bắt được: có stack,
không có ai gọi, endpoint nào, user nào, request id nào. Đề xuất: pino, một
`X-Request-Id` sinh ở middleware đầu, log JSON một dòng mỗi request
(method, path, status, ms, user_id, req_id) và mỗi lỗi. SOC parse JSON dễ hơn
parse stack trace nhiều.

**2.2 Bảng `audit_logs`.** Mọi hành động quyền lực — duyệt/từ chối bài, xoá nội
dung, đổi vai trò, khoá tài khoản, đổi cấu hình site — ghi lại
`(actor_id, action, target_type, target_id, before, after, ip, created_at)`.
Ba lợi ích: điều tra khi có tranh chấp "ai xoá bài tôi", phát hiện admin bị
chiếm quyền, và là bằng chứng tuân thủ (mục 4).

**2.3 Rate limit hiện là Map in-process.** Đúng cho 1 container, sai ngay khi
scale ra 2. Chưa cần Redis bây giờ, nhưng nên tách interface để sau này đổi
backend mà không sửa call site.

**2.4 Uploads nằm trên volume local** (`./backend/uploads:/app/uploads`). Chưa
có dọn ảnh mồ côi khi bài bị xoá, chưa có backup. Một job dọn định kỳ + tài
liệu backup là đủ ở quy mô này.

**2.5 `/health` chỉ trả `{status: ok}`** — không chạm database. Thêm
`/health/ready` có `select 1` để orchestrator biết lúc nào DB rớt.

---

## 3. Tính năng sản phẩm (theo thứ tự tác động)

**3.1 Thông báo — thiếu hẳn, và là thứ đáng làm nhất.**
Toàn repo không có bảng notification nào. Forum sống bằng vòng lặp "có người
trả lời bạn → bạn quay lại". Không có nó thì người dùng đăng bài xong là đi
luôn. Phạm vi tối thiểu: bảng `notifications (user_id, type, actor_id,
target_type, target_id, read_at)`, sinh sự kiện ở 5 chỗ (bình luận trên bài
mình, trả lời bình luận mình, bài được duyệt / bị từ chối, câu trả lời được
chấp nhận, được xác minh bác sĩ), API `GET /notifications` + `PATCH /read`,
chuông đếm số chưa đọc ở Header. Polling 30 giây trước, SSE sau nếu cần.

**3.2 Tìm kiếm — đang là `ILIKE '%...%'`, không index được.**
`posts.search_text` là `text` không index, câu truy vấn dùng
`ilike('%needle%')` cho cả `search_text`, `title` và `content` → sequential
scan toàn bảng, chậm tuyến tính theo số bài. Hai bước:

1. Rẻ và không đổi code: `CREATE EXTENSION pg_trgm;` +
   `CREATE INDEX ... USING gin (search_text gin_trgm_ops)`. Câu lệnh hiện tại
   ăn index luôn.
2. Đúng bài bản: cột generated `tsvector` từ `unaccent(title || content)`,
   index GIN, xếp hạng bằng `ts_rank`. Tiếng Việt dùng config `simple` +
   `unaccent` là đủ tốt (không có stemmer tiếng Việt trong Postgres);
   `deaccent()` sẵn có ở `lib/slugify.ts` đã làm đúng nửa việc rồi.

**3.3 Email.** Chưa có gì. Mở ra: đặt lại mật khẩu, xác minh email khi đăng ký,
digest thông báo. Ở quy mô này một SMTP provider + template đơn giản là đủ,
nhưng nên thêm hàng đợi tối thiểu (bảng `email_outbox`) để lỗi SMTP không làm
hỏng request.

**3.4 Hồ sơ bác sĩ.** `doctor_verifications` đã có, nhưng vai trò `doctor` mới
dừng ở cái badge. Nên có: trang hồ sơ công khai (chuyên khoa, nơi công tác, số
chứng chỉ hành nghề đã che bớt), bộ lọc "chỉ xem bài/trả lời của bác sĩ", và
sắp xếp câu trả lời ưu tiên bác sĩ đã xác minh. Đây là điểm khác biệt duy nhất
mà một forum y tế có so với forum tổng hợp — nên khai thác.

**3.5 SEO cho mảng YMYL.** Đã có sitemap. Còn thiếu meta/OG động theo bài,
JSON-LD (`MedicalWebPage`, `QAPage`), hiển thị "cập nhật lần cuối" và "duyệt
bởi <bác sĩ đã xác minh>". Nội dung y tế bị Google soi E-E-A-T nặng hơn mọi
chủ đề khác; ba thứ đó là tín hiệu rẻ nhất để lấy.

**3.6 Kiểm duyệt bán tự động.** `lib/spamGuard.ts` đã có sẵn khung. Mở rộng
thành bộ luật theo từ khoá đặc thù y tế: rao bán thuốc kê đơn, "chữa khỏi ung
thư/tiểu đường", số điện thoại + zalo trong bài, thực phẩm chức năng. Không tự
xoá — chỉ tự gắn cờ và đẩy lên đầu hàng đợi duyệt. Giữ người ra quyết định.

---

## 4. Pháp lý Việt Nam — cần biết trước khi mở công khai

Hai văn bản chạm trực tiếp vào dự án này.

**4.1 Nghị định 147/2024/NĐ-CP** (hiệu lực 25/12/2024). Mạng xã hội trong nước
phải xác thực tài khoản bằng **số điện thoại di động** (hoặc số định danh cá
nhân nếu không có SĐT Việt Nam), và **chỉ tài khoản đã xác thực mới được đăng
bài, bình luận, livestream**. Trẻ dưới 16 tuổi phải do cha mẹ/người giám hộ
đăng ký. Ảnh hưởng kiến trúc: schema `users` hiện **không có trường phone** —
cần `phone`, `phone_verified_at`, luồng OTP, và một cổng chặn ở tầng
`requireAuth` cho các hành động ghi. Biết sớm thì rẻ, bọc sau thì đắt.

**4.2 Luật Bảo vệ dữ liệu cá nhân** (hiệu lực 01/01/2026). Thông tin sức khoẻ
là **dữ liệu cá nhân nhạy cảm** — mà cả forum này là nơi người ta kể bệnh của
chính mình. Điểm chạm code:

- Quyền xoá dữ liệu: `DELETE /users/:id` hiện chỉ set `is_active = false`.
  Cần luồng xoá/ẩn danh thật (giữ nội dung, tách khỏi danh tính) và tự phục vụ
  được, không phải email xin admin.
- Cơ chế đồng ý rõ ràng khi đăng ký, và rút đồng ý được.
- Thông báo vi phạm dữ liệu cho cơ quan chuyên trách **trong 72 giờ** — muốn
  làm được thì phải phát hiện được, tức là quay lại mục 2.1 và 2.2.
- Mức phạt được nhắc tới có thể lên tới 5% doanh thu năm liền kề.

Đây là tóm tắt từ báo chí và cổng thông tin, chưa đọc nguyên văn văn bản. Nếu
định mở cho người ngoài dùng thật thì nên tra nguyên văn hoặc hỏi luật sư.

**4.3 Miễn trừ trách nhiệm y tế.** Rẻ, nên có ngay: banner cố định "nội dung
trên diễn đàn không thay thế tư vấn y tế chuyên môn", chặn/gắn cờ bài kê đơn
cụ thể, và quy chế hoạt động công khai.

---

## 5. Thứ tự đề xuất

1. CI (`.github/workflows`: typecheck + test backend + build frontend) — nửa
   ngày, chặn được cả lớp lỗi như `/admin/stats` vừa rồi.
2. Đóng G4 và G6 — hai lỗi đúng/sai dữ liệu, sửa nhanh, đã có mô tả sẵn.
3. Log có cấu trúc + request id + bảng `audit_logs` — nền cho mọi việc sau.
4. Thông báo — tính năng tạo khác biệt lớn nhất cho trải nghiệm.
5. Index tìm kiếm (bước pg_trgm) — một migration, không sửa code.
6. Email + đặt lại mật khẩu.
7. Quyết định sớm: có mở công khai không. Nếu có → xác thực SĐT (4.1) và luồng
   xoá dữ liệu (4.2) phải vào roadmap ngay, vì cả hai đụng schema.

---

## Nguồn

- Nghị định 147/2024/NĐ-CP — https://thuvienphapluat.vn/banan/tin-tuc/nghi-dinh-1472024ndcp-chinh-thuc-bat-buoc-xac-thuc-tai-khoan-mang-xa-hoi-bang-so-dien-thoai-12259
- Nghị định 147 có hiệu lực (ABEI, Bộ TT&TT) — https://abei.gov.vn/thong-tin-dien-tu/nghi-dinh-147-ve-quan-ly-internet-va-thong-tin-tren-mang-chinh-thuc-co-hieu-luc/118622
- Luật Bảo vệ dữ liệu cá nhân từ 1/1/2026 — https://vneconomy.vn/nhung-diem-moi-trong-luat-bao-ve-du-lieu-ca-nhan-tu-112026.htm
- Thông tin sức khoẻ là dữ liệu cá nhân nhạy cảm — https://luatvietnam.vn/tin-van-ban-moi/thong-tin-ve-suc-khoe-la-du-lieu-ca-nhan-nhay-cam-186-106394-article.html
- Quyền yêu cầu xoá dữ liệu cá nhân từ 2026 — https://vnexpress.net/tu-2026-nguoi-dan-co-quyen-yeu-cau-xoa-du-lieu-ca-nhan-4999068.html
