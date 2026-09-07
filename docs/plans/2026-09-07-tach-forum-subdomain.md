# Tách diễn đàn sang forum.medicvn.com

Ngày: 2026-09-07. Người soạn: Claude (theo yêu cầu của Tanh, chuyển từ yêu cầu của sếp).
Cơ sở: đọc `backend/src`, `frontend/src`, `docker-compose*.yml`, `frontend/nginx.conf`,
`docs/plans/2026-09-03-de-xuat-phat-trien.md`.

Bản thiết kế trực quan (sơ đồ + mockup): xem canvas "Tách diễn đàn Medic Việt Nam".

---

## 0. Yêu cầu gốc và cách hiểu

Sếp yêu cầu bốn điều:

1. `medicvn.com` giữ nguyên, là trang chính;
2. người dùng cần vào diễn đàn thì chuyển ngay sang `forum.medicvn.com`;
3. trang con là **một web độc lập**, đồng bộ tài khoản từ trang mẹ;
4. dữ liệu cũng "crawl về"; trang chính đóng vai trò đăng bài báo, tin tức.

Ba điều đầu làm đúng như mô tả. Điều thứ tư giữ **mục tiêu** nhưng đổi **cách làm**:
không crawl HTML của chính mình. Hai bên cùng chủ, đã có API và database — đi vòng qua
trình duyệt để đọc lại HTML mình vừa in ra là thêm một chỗ để hỏng: đổi một class
Tailwind là bộ crawl gãy, và không có cách nào biết bài nào vừa bị gỡ. Thay bằng một
endpoint JSON có con trỏ và có danh sách bài đã xoá (mục 4).

**Quyết định kiến trúc chính:** "độc lập" được làm theo từng lớp, không làm một phát.
Chặng 1 tách **vỏ** (tên miền, build, container, nhịp deploy) nhưng dùng chung backend và
database. Chặng 3 mới tách **ruột** (API riêng, database riêng), và chỉ khi có lý do thật.
Lý do: hai database nghĩa là mọi câu hỏi "bài này của ai" biến thành một lời gọi mạng có
thể thất bại. Cái giá đó phải có người trả; hiện chưa ai cần nó.

---

## 1. Hiện trạng liên quan

| Thứ | Ở đâu | Ảnh hưởng |
|---|---|---|
| Diễn đàn là route trong SPA | `frontend/src/App.tsx` — `/forum`, `/forum/:slug` | Phải tách ra app riêng |
| Một thớt = một bài viết, một trả lời = một bình luận | `frontend/src/pages/ForumPage.tsx` | **Giữ nguyên thiết kế này.** Không thêm bảng `threads` |
| Token nằm trong `localStorage` | `frontend/src/stores/authStore.ts` | `localStorage` gắn với một origin → tên miền con không đọc được. **Bắt buộc đổi** |
| Chỉ giữ access token, 401 là logout luôn | `frontend/src/lib/api.ts` (nợ G3) | Sửa cùng lúc với cookie — một công đôi việc |
| CORS đọc từ `BACKEND_CORS_ORIGINS` | `backend/src/core/config.ts` | Thêm origin tên miền con, bật credentials |
| Nginx phục vụ SPA, cổng 3000 | `frontend/nginx.conf` | Thêm một service thứ hai cổng 3001 |
| Cây chuyên mục 3 cấp, sửa ở `/admin` | `backend/src/routes/categories.ts` | Nguồn sự thật duy nhất, diễn đàn chỉ đọc |
| `site_settings.network` — mạng lưới trang anh em | `backend/src/lib/siteSettings.ts` | Dùng lại để khai báo cặp trang mẹ/con |
| Hạ tầng: Cloudflare Tunnel → NPM, không mở port | (ngoài repo) | Thêm một ingress, không đổi nguyên tắc |

---

## 2. Chặng 0 — dọn đường (≈ 1 ngày, không đụng code ứng dụng)

1. Bản ghi DNS `forum` trong Cloudflare, thêm ingress trong tunnel trỏ về NPM.
2. Proxy host mới trong NPM: `forum.medicvn.com` → container diễn đàn cổng 3001,
   bật SSL, giữ nguyên cấu hình đọc IP thật qua `CF-Connecting-IP` như host hiện tại.
3. Thêm biến vào `.env` và `.env.example`:

   ```env
   PORTAL_URL=https://medicvn.com
   FORUM_URL=https://forum.medicvn.com
   COOKIE_DOMAIN=.medicvn.com
   BACKEND_CORS_ORIGINS=["https://medicvn.com","https://forum.medicvn.com"]
   VITE_PORTAL_URL=https://medicvn.com
   VITE_FORUM_URL=https://forum.medicvn.com
   ```

4. Sửa `PROJECT.md` — đang mô tả kiến trúc FastAPI + SQLAlchemy + Alembic, code là
   Hono + Drizzle từ lâu. Tài liệu sai hại hơn không có tài liệu, và người làm chặng 1
   sẽ đọc nó đầu tiên.

**Xong khi:** mở `https://forum.medicvn.com` ra trang trắng có chứng chỉ hợp lệ.

---

## 3. Chặng 1 — tách vỏ, chung ruột (≈ 2–3 ngày)

Đây là chặng cho ra đúng thứ sếp mô tả. Sau chặng này việc còn lại là làm dày, không
phải làm lại.

### 3.1 Một mã nguồn, hai bản build

Không tạo repo thứ hai và **không copy thư mục `components/`**. Sáu tháng sau hai bộ
nút bấm khác nhau là chuyện gần như chắc chắn nếu copy.

- `frontend/src/apps/PortalApp.tsx` — nội dung `App.tsx` hiện tại, **bỏ** route
  `/forum` và `/forum/:slug`.
- `frontend/src/apps/ForumApp.tsx` — router của diễn đàn:
  `/` (danh sách box, từ `ForumPage`), `/c/:slug` (từ `ForumCategoryPage`),
  `/t/:id` (từ `PostDetailPage`), `/tao-chu-de`, `/u/:id`.
- `frontend/src/main.tsx` chọn app theo `import.meta.env.VITE_APP` (`portal` | `forum`).
- `frontend/vite.config.ts`: giữ nguyên, chỉ build hai lần với biến môi trường khác nhau.
- `frontend/Dockerfile`: thêm `ARG VITE_APP=portal`, truyền vào bước build.
- `docker-compose.yml`: thêm service `frontend-forum` (cùng context, `VITE_APP=forum`,
  cổng 3001, `nginx.forum.conf`).

Layout, Header, Sidebar, FeedCard, Badges, editor... dùng chung nguyên vẹn. `Header`
nhận thêm prop `variant: 'portal' | 'forum'` để đổi nhãn cạnh logo và lối quay về.

### 3.2 Một lần đăng nhập cho cả hai tên miền

Đây là phần bắt buộc phải đổi, không có đường vòng.

`backend/src/routes/auth.ts`:

- `issueTokens()` ngoài việc trả JSON như cũ, đặt thêm cookie refresh:
  `Set-Cookie: mv_rt=<token>; HttpOnly; Secure; SameSite=Lax; Domain=.medicvn.com; Path=/api/v1/auth; Max-Age=604800`
- `POST /auth/refresh`: nếu body không có `refresh_token` thì đọc từ cookie.
- Thêm `POST /auth/logout`: xoá cookie (`Max-Age=0`), trả 204.

`backend/src/app.ts`: CORS đặt `credentials: true` và origin lấy từ danh sách cấu hình
(không dùng `*`, browser từ chối khi có credentials — `config.ts` đã ghi chú đúng chuyện này).

`frontend/src/lib/api.ts`:

- mọi request kèm `credentials: 'include'`;
- gặp 401 thì **thử `POST /auth/refresh` một lần** rồi phát lại request gốc, thất bại
  mới logout. Đóng luôn nợ G3 trong `docs/plans/2026-09-03-de-xuat-phat-trien.md`.

`frontend/src/stores/authStore.ts`: bỏ ghi refresh token xuống `localStorage`.
Access token giữ trong bộ nhớ; mở tab mới thì lấy lại bằng `/auth/refresh`.

Chưa đăng nhập vẫn đọc được diễn đàn. Nút "Trả lời" và "Tạo chủ đề" đưa về
`${PORTAL_URL}/login?next=<url hiện tại>`; `LoginPage` đọc `next`, chỉ chấp nhận URL
thuộc `medicvn.com` hoặc `forum.medicvn.com` (danh sách trắng — nếu không thì đây là một
open redirect).

### 3.3 Link cũ không được gãy

Trong `frontend/nginx.conf` của **bản portal**, đặt trước khối SPA fallback:

```nginx
location ^~ /forum {
    rewrite ^/forum/?(.*)$ https://forum.medicvn.com/$1 permanent;
}
```

301 chứ không 302: 302 nói với Google rằng chỗ này chỉ tạm thời, và thứ hạng ở lại
trang mẹ trong khi nội dung đã đi.

### 3.4 Hai trang phải trông như một sản phẩm

Cùng logo, cùng bảng màu (`#3B82F6` primary, nền `#F8FAFC`, viền `#E2E8F0`), cùng bo góc
16px, cùng font Inter. Khác biệt duy nhất: nhãn "Diễn đàn" cạnh logo bên trang con, và
mục "Diễn đàn" ở sidebar trái trang mẹ mang mũi tên rời trang.

**Không** làm màn hình trung gian "Đang chuyển hướng...". Nó chỉ thêm một giây chờ.

**Xong khi:** đăng nhập ở `medicvn.com`, bấm "Diễn đàn", sang tên miền con vẫn thấy tên
mình mà không phải nhập lại; đăng xuất một bên là mất phiên cả hai bên.

---

## 4. Chặng 2 — diễn đàn thành diễn đàn thật (≈ 2 tuần)

### 4.1 Những gì `posts` + `comments` còn thiếu để làm thớt

Giữ nguyên quyết định "một thớt là một bài viết" — nó đúng và đã chạy. Thêm vào
`backend/src/db/schema.ts`:

```
posts.is_pinned    boolean not null default false
posts.is_locked    boolean not null default false
posts.last_reply_at timestamptz          -- xếp box theo hoạt động, không phải theo ngày tạo
```

Cùng migration thêm index `ix_posts_category_last_reply (category_id, last_reply_at desc)`
— danh sách thớt trong một box là truy vấn chạy nhiều nhất của diễn đàn.

API: `GET /api/v1/forum/:slug/threads?page=&sort=` phân trang theo trang số (diễn đàn
dùng số trang, không dùng cursor như bảng tin — người ta nhảy tới trang 12 của một thớt).

### 4.2 Đồng bộ nội dung từ trang mẹ

Bảng mới ở phía diễn đàn:

```
mirrored_posts
  id             uuid pk
  source_id      uuid unique      -- id bài bên trang mẹ
  slug, title, excerpt, canonical_url
  category_id    uuid -> categories
  thread_id      uuid -> posts    -- thớt thảo luận sinh kèm
  source_updated timestamptz
  synced_at      timestamptz
```

Endpoint nguồn (`backend/src/routes/sync.ts`):

```
GET /api/v1/sync/posts?since=<iso>&limit=200
  X-Sync-Timestamp: <unix>
  X-Sync-Signature: sha256=<hmac(SYNC_SECRET, timestamp + body)>
->
  { items: [...], deleted: [uuid...], next_since: "<iso>" }
```

Ba tính chất khiến nó không sập: con trỏ theo `updated_at` (chạy lại vô hại), mảng
`deleted` (bài gỡ ở trang mẹ thì mất ở diễn đàn), ghi bằng `upsert` theo `source_id`
(chạy hai lần không sinh bản trùng). Chỉ trả bài `status = approved` **và**
`is_published = true`.

Worker kéo mỗi 5 phút. Thất bại thì giữ nguyên con trỏ cũ, thử lại theo cấp số nhân
1–2–4–8 phút (trần 30). Quá 6 lần liên tiếp thì ghi `sync_failures` và hiện cảnh báo
trong `/admin`. Đồng bộ chậm một giờ không ai chết; đồng bộ sai mới phiền.

**Bẫy SEO — quan trọng vì đây là nội dung y tế.** Bản sao ở diễn đàn phải mang
`rel=canonical` trỏ về `canonical_url` của trang mẹ và gắn `noindex`. Chỉ phần thảo luận
bên dưới mới được đánh chỉ mục. Google soi E-E-A-T với YMYL nặng hơn mọi chủ đề khác;
mất điểm ở đây rất khó lấy lại.

### 4.3 Chiều ngược — để hai trang còn dính vào nhau

`GET /api/v1/public/hot-threads?limit=5` trên diễn đàn, JSON công khai, cache 60 giây.
`SidebarRight` của trang mẹ thêm thẻ "Đang bàn luận". Gọi hỏng thì **ẩn thẻ**, không
làm vỡ trang — trang mẹ không được phụ thuộc vào diễn đàn còn sống.

### 4.4 Thông báo

Không có nó thì tách diễn đàn ra chỉ làm người dùng khó quay lại hơn. Phạm vi tối thiểu
đã mô tả ở mục 3.1 của `2026-09-03-de-xuat-phat-trien.md` — làm đúng phạm vi đó, thêm
sự kiện "có người trả lời thớt bạn theo dõi".

---

## 5. Chặng 3 — độc lập hoàn toàn (chỉ khi có lý do)

Làm khi và chỉ khi: có đội riêng cho diễn đàn, hoặc tải của diễn đàn ảnh hưởng trang tin,
hoặc cần bán/tách hẳn sản phẩm.

- API riêng cho diễn đàn, database riêng.
- SSO đổi sang trao mã một lần: diễn đàn → `medicvn.com/sso/authorize`
  (`redirect_uri` trong danh sách trắng + `state` chống CSRF) → mã sống 60 giây, dùng một
  lần → backend diễn đàn đổi mã lấy hồ sơ qua `POST /api/v1/sso/token` kèm client secret
  (gọi từ server, không qua trình duyệt).
- Người dùng cục bộ khoá theo `parent_user_id` (UUID trang mẹ), **không** theo email —
  người dùng đổi email thì tài khoản vẫn là một.
- **Diễn đàn không bao giờ giữ mật khẩu.** Không có bảng mật khẩu thì cũng không có gì
  để rò rỉ.
- Webhook `user.updated` từ trang mẹ + đối soát định kỳ. Đây không phải tiện nghi:
  admin khoá một người mà diễn đàn còn giữ token 7 ngày thì người đó đăng bài tiếp cả
  tuần.
- Ảnh dùng chung qua `cdn.medicvn.com` để không nhân đôi ảnh của cùng một bài.

---

## 6. Kiểm chứng

Mỗi chặng phải qua trước khi sang chặng sau:

- `cd backend && npm test && npm run typecheck` — 101 test Vitest hiện có phải xanh.
- Test mới cho chặng 1: `/auth/refresh` đọc được cookie; CORS từ chối origin lạ;
  `next` ngoài danh sách trắng bị bỏ qua.
- Test mới cho chặng 2: `since` chạy lại không sinh bản trùng; `deleted` xoá được bản sao;
  chữ ký sai trả 401.
- Thủ công: đăng nhập trang mẹ → sang diễn đàn không phải nhập lại; đăng xuất một bên
  mất phiên cả hai; `medicvn.com/forum/tim-mach` trả 301 về đúng
  `forum.medicvn.com/c/tim-mach`; tắt container diễn đàn → trang mẹ vẫn tải bình thường,
  chỉ thiếu thẻ "Đang bàn luận".
- Khai báo `forum.medicvn.com` trong Google Search Console **ngay hôm chuyển**, nộp
  sitemap riêng.

---

## 7. Cố tình không làm

- **Không crawl HTML.** Đã có database chung và API sẵn.
- **Không tách database ở chặng 1.** Chưa có ai trả cái giá đó.
- **Không thêm bảng `threads`/`replies`.** `posts` + `comments` đã là mô hình đúng và
  đang chạy; thêm bảng song song nghĩa là hai đường ghi cho cùng một thứ.
- **Không dựng diễn đàn từ Discourse / XenForo.** Tài khoản, huy hiệu bác sĩ đã xác minh,
  cây chuyên khoa đều nằm ở đây; ghép chúng vào một hệ khác tốn hơn là viết tiếp.
- **Không dùng iframe** để nhúng diễn đàn vào trang mẹ. Hỏng cookie, hỏng SEO, hỏng
  nút back.

---

## 8. Nhật ký thực hiện — Chặng 1 (2026-09-07)

Chặng 0 và chặng 1 đã code xong. Chặng 2 và 3 vẫn ở dạng kế hoạch.

### Khác với kế hoạch

| Kế hoạch | Thực tế | Vì sao |
|---|---|---|
| Diễn đàn cổng 3001 | **Cổng 4000** | Theo yêu cầu, để trỏ NPM |
| Sửa nợ G3 (401 là logout) | Đã có sẵn ở HEAD | `lib/api.ts` đã làm refresh-on-401 từ trước; chỉ nới điều kiện để chạy được với cookie |
| Route diễn đàn đổi sang `/c/:slug` | **Giữ nguyên `/forum/:slug`** | Đổi thì phải sửa hàng chục liên kết trong component dùng chung và làm gãy mọi link đã chia sẻ |

### Đã thay đổi

**Backend**

- `src/core/config.ts` — thêm `PORTAL_URL`, `FORUM_URL`, `COOKIE_DOMAIN`.
- `src/routes/auth.ts` — cookie `mv_rt` (HttpOnly, SameSite=Lax, `Path=/api/v1/auth`,
  `Domain` lấy từ `COOKIE_DOMAIN`); `/auth/refresh` đọc được token từ cookie khi
  không có body; thêm `POST /auth/logout`; cookie bị xoá ngay khi token hỏng,
  người dùng không tồn tại, hoặc **tài khoản bị khoá**.
- `tests/sso.test.ts` — 7 test mới cho đúng luồng này.

**Frontend** — một mã nguồn, hai bản dựng, chọn bằng `VITE_APP`:

- `src/lib/siteLinks.ts` (mới) — biết mình là bản nào, dựng liên kết sang trang kia,
  và `safeNext()` chặn open redirect ở tham số `?next`.
- `src/components/common/SiteLink.tsx` (mới) — cùng tên miền thì `<Link>`, khác tên
  miền thì `<a>`.
- `src/components/common/ExternalRedirect.tsx` (mới) — lưới đỡ cho dev, nơi không có nginx.
- `src/hooks/useSilentLogin.ts` (mới) — mở trang là đổi cookie lấy phiên đăng nhập.
- `src/apps/PortalApp.tsx`, `src/apps/ForumApp.tsx` (mới) — hai tập route.
- `src/App.tsx` — chọn app theo `IS_FORUM`.
- `src/lib/api.ts` — `withCredentials`, làm mới được token khi chỉ có cookie,
  hết phiên thì về trang đăng nhập của cổng tin tức kèm `next`.
- `src/stores/authStore.ts` — **không lưu refresh token xuống localStorage nữa**.
- `Header`, `SidebarLeft`, `CategoryStrip`, `ForumPage`, `ForumCategoryPage`,
  `LoginPage`, `MainLayout` — liên kết chéo hai trang, nhãn "Diễn đàn", lối về "Trang tin",
  đăng xuất gọi `/auth/logout`.

**Hạ tầng**

- `frontend/nginx.forum.conf` (mới) — nghe cổng 4000.
- `frontend/nginx.conf` — `location ^~ /forum` trả **301** sang `https://forum.medicvn.com`
  (đây là chỗ duy nhất ghi tên miền diễn đàn ở phía trang tin).
- `frontend/Dockerfile` — `ARG VITE_APP`, `ARG NGINX_CONF`.
- `docker-compose.yml` / `.prod.yml` — thêm service `frontend-forum` cổng 4000.
- `.env` / `.env.example` — `PORTAL_URL`, `FORUM_URL`, `VITE_*`, `COOKIE_DOMAIN`,
  và thêm hai tên miền vào `BACKEND_CORS_ORIGINS`.

### Kết quả kiểm chứng

Chạy trên một bản cài sạch (node_modules trên máy đang hỏng, xem dưới):

- `tsc --noEmit` backend: sạch.
- `tsc --noEmit` frontend: sạch.
- `vitest run`: **146/146 test xanh** (139 cũ + 7 mới).
- `vite build` cả hai bản: xanh. Bản diễn đàn **761 kB** so với bản tin tức
  **1.268 kB** — Vite loại bỏ trang quản trị và recharts khỏi bản diễn đàn.

### Việc còn phải làm bằng tay

1. **`backend/node_modules` trên máy đang hỏng** (có từ trước: `@types/node/url.d.ts`
   bị cắt cụt giữa chừng, `hono` thiếu file khai báo kiểu). Docker không bị ảnh hưởng
   vì image tự `npm install` bên trong. Muốn chạy `npm test` ngoài Docker thì xoá
   `backend/node_modules` rồi `npm install` lại.
2. **`_to_delete/`** trong `backend/` và `frontend/` chứa file tạm dùng để kiểm chứng —
   xoá được, không có gì trong repo tham chiếu tới.
3. **NPM**: thêm proxy host `forum.medicvn.com` → container `frontend-forum` cổng 4000.
4. Sau khi đổi tên miền: khai báo `forum.medicvn.com` trong Google Search Console,
   nộp sitemap riêng.

---

## 9. Nhật ký thực hiện — Chặng 2, phần nối hai trang (2026-09-07)

### Một chỗ trong kế hoạch phải sửa

Mục 4.2 xếp `mirrored_posts` + worker đồng bộ 5 phút vào chặng 2. Khi bắt tay
vào làm mới thấy điều đó **không đứng vững ở chặng 2**: chặng 1 cố ý để hai
trang dùng chung một database, nên một worker kéo bài từ database này rồi ghi
vào chính nó là công việc rỗng — diễn đàn đã đọc thẳng bảng `posts` rồi. Xây
một đường ống đồng bộ chỉ để copy dữ liệu về đúng chỗ nó đang nằm là thêm một
thứ để hỏng mà không đổi lấy gì.

`mirrored_posts`, endpoint `/sync/posts` ký HMAC, con trỏ `since`, mảng
`deleted`, `rel=canonical` — **chuyển hết sang chặng 3**, nơi database thật sự
tách và chúng mới có việc để làm. Mục 4.2 giữ nguyên như một bản thiết kế sẵn
cho lúc đó.

Cái *thật sự* thiếu ở chặng 2, và đã làm, là hai đường nối giữa hai tên miền —
đúng hai thứ vẽ trong bản thiết kế:

### Đã thay đổi

**Backend**

- `src/routes/stats.ts` — thêm `GET /api/v1/forum/hot-threads?limit=`.
  Chỉ lấy thớt **đã có ít nhất một trả lời**, xếp theo lần trả lời gần nhất chứ
  không theo ngày đăng, cache 60 giây. Bài chờ duyệt không lọt ra.
- `tests/hot-threads.test.ts` — 6 test: thứ tự xếp, lọc bài chưa ai trả lời,
  chặn bài chờ duyệt, đủ trường cho sidebar, kẹp `limit` lạ, header cache.

**Frontend**

- `services/forumService.ts` — `getHotThreads()` và kiểu `HotThread`.
- `components/Sidebar/SidebarRight.tsx` — thẻ **"Đang bàn luận"**, chỉ hiện ở
  cổng tin tức, mỗi dòng trỏ thẳng sang thớt bên `forum.medicvn.com`. Gọi hỏng
  thì thẻ ẩn đi chứ không làm vỡ sidebar: trang tin không được phụ thuộc vào
  việc diễn đàn còn sống.
- `components/Feed/FeedCard.tsx` — nút **"Thảo luận"** dưới mỗi bài ở bảng tin,
  mở thớt tương ứng bên diễn đàn. Không có lối đi này thì tách hai tên miền
  chỉ làm người đọc mất đường, chứ không được gì.

### Kết quả kiểm chứng

- `tsc --noEmit` backend và frontend: sạch.
- `vitest run`: **152/152 test xanh** (139 gốc + 7 SSO + 6 hot-threads).
- `vite build` cả hai bản: xanh.

### Còn lại của chặng 2

Chưa làm, và cố ý để riêng vì mỗi thứ là một tính năng đủ lớn:

- **Thông báo** ("có người trả lời bạn"). Đây là thứ đáng làm nhất tiếp theo —
  không có nó thì tách diễn đàn ra chỉ khiến người dùng khó quay lại hơn.
- **Ghim / khoá thớt, phân trang theo số trang** cho danh sách thớt.
- `posts.last_reply_at` + index `(category_id, last_reply_at desc)`. Hiện thời
  điểm trả lời gần nhất tính bằng truy vấn con; ở quy mô này còn rẻ hơn cái giá
  của một cột phi chuẩn hoá phải cập nhật ở mọi chỗ tạo và xoá bình luận. Khi
  bảng `comments` đủ lớn để chậm thì hẵng đổi.
