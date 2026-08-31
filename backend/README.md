# Healthcare Forum — backend (TypeScript)

Hono + Drizzle + Zod on Node 20. Replaces the FastAPI backend one-for-one:
same 49 API paths, same JSON shapes, same Postgres database. The frontend
was not touched.

## Running

Postgres lives outside this stack, on **192.168.1.102** — set `DATABASE_URL`
in `.env`. There is no `db` service in the default compose file any more.

```bash
docker compose up          # dev — the service is still called "backend" on :8000
docker compose -f docker-compose.yml -f docker-compose.prod.yml up   # prod

# To run a throwaway local database instead of the shared one:
docker compose -f docker-compose.yml -f docker-compose.db.yml up
```

The bootstrap retries the database connection ten times before giving up, so
the container coming up before the remote Postgres is reachable is not fatal.

Locally, without Docker:

```bash
npm install
npm run dev          # tsx watch on :8000
npm test             # vitest against PGlite, no database needed
npm run typecheck
npm run build        # tsc -> dist/
```

`entrypoint.sh` runs three steps before serving, all idempotent:
`migrate` (creates the schema only on a brand-new database),
`sanitizeExisting` (cleans content stored before sanitising existed), and
`createAdmin`.

## Layout

| Path | What lives there |
| --- | --- |
| `src/db/schema.ts` | Drizzle tables, matching the two Alembic migrations exactly |
| `src/schemas/responses.ts` | Zod response builders — the only place a row becomes JSON |
| `src/schemas/requests.ts` | Input validation, replacing the Pydantic models |
| `src/core/` | config, JWT + bcrypt, the shared error handler |
| `src/middleware/` | auth, role guards, rate limiting |
| `src/routes/` | one file per former APIRouter |
| `src/lib/` | sanitising, slugify, cursor + batched post queries |
| `drizzle/0000_init.sql` | DDL for a fresh database |
| `drizzle/0001_*.sql` | Idempotent patches, applied on every boot |

## Rules this port follows

**Every response is built field by field and parsed by Zod.** FastAPI used
`response_model=` to filter rows on the way out — that filtering, not the
handlers, is what kept `hashed_password` out of `GET /users/{id}`, which
returned the ORM object directly. Hono has no equivalent, so no handler
spreads a database row into a response. A test sweeps the whole surface for
bcrypt digests.

**Field names stay snake_case.** `frontend/src/types/index.ts` declares
optional camelCase aliases (`fullName?`, `helpfulCount?`), so a camelCase
response would still type-check on the frontend and render `undefined`.
Drizzle field names therefore match the column names exactly.

**Errors keep Pydantic's shape.** Ten places in the frontend read
`err.response.data.detail`, and `CreatePostPage.tsx` branches on `detail`
being an array of `{loc, msg, type}`. One `app.onError` produces both.

**401 and 403 keep their meanings.** `lib/api.ts` logs the user out on any
401 outside `/auth/*`, so a deactivated account and an insufficient role
both return 403, exactly as the Python dependencies did.

**Behaviour was ported as-is, except for security.** Where the two differ,
it is deliberate and listed below.

## Deliberate changes

| Change | Why |
| --- | --- |
| Post and comment HTML is sanitised on write | Both are rendered with `dangerouslySetInnerHTML`, including in the moderation preview — a member's post could run script inside a moderator's session, and the auth token lives in `localStorage` |
| One-off pass over existing rows | Content stored before this change is still in the database |
| Refresh tokens carry `type: "refresh"` and are required at `/auth/refresh` | Both tokens had identical payloads, so a leaked 30-minute access token could be traded for a 7-day refresh token, indefinitely |
| A refresh token is rejected as a bearer credential | Same reason, other direction |
| `/auth/refresh` validates the subject is a UUID | `auth.py:54` compared a string to a uuid column and raised on Postgres; it had no test |
| SQL logging is off unless `SQL_ECHO=true` | `echo=True` was hardcoded and logged every statement with its parameters |
| Rate limits on login, register, report and upload | There were none; report flooding is the cheapest way to bury the moderation queue |
| CORS reads real origins; `*` falls back to localhost | `allow_origins=["*"]` with `allow_credentials=True` is rejected by browsers and unsafe |
| `JWT_SECRET` under 32 chars refuses to boot in production | The default key was committed |
| The first admin needs `ADMIN_PASSWORD` | `create_admin.py` hardcoded `admin123` |
| Uploads are named from the format sharp detects, not the client's extension | The extension was taken on trust |
| `/uploads` is served with `nosniff` and a `default-src 'none'; sandbox` CSP | Stops a stored file being interpreted as a document |
| `GET /users/me/bookmarks` returns each post's real `status` | The Python response omitted it, so Pydantic defaulted every saved post to `pending` and `FeedCard` drew a review badge on all of them |
| Admin user list uses two grouped queries | It ran two queries per user |

## Category tree

Categories carry a `parent_id`, two levels deep: a root can have children, a
child cannot. `GET /categories` stays a flat list with each child listed
directly after its parent, so the admin table, the sidebar and the post form
all build the tree from one response instead of a second nested endpoint.

Opening a parent shows its own posts **plus everything under its children**,
and `post_count` follows the same rule. Deleting a parent leaves its children
in place as roots (the foreign key is `ON DELETE SET NULL`) rather than taking
a whole branch of the forum with it.

## Vietnamese forum features

| Thứ | Nằm ở đâu | Ghi chú |
| --- | --- | --- |
| Tìm không dấu | `posts.search_text` | Bản chữ thường, bỏ dấu của tiêu đề + tóm tắt + nội dung, ghi lúc lưu. Không cần extension nào của Postgres, và chữ `đ` được xử lý riêng vì NFD không tách nó. |
| Câu trả lời được chấp nhận | `posts.accepted_comment_id` | `PUT /posts/:id/accepted-answer`, chỉ tác giả hoặc staff. Bình luận được chọn luôn đứng đầu cây. |
| Đăng ẩn danh | `posts.is_anonymous`, `comments.is_anonymous` | Người đọc thấy một tác giả giả lập không mang id thật; tác giả và staff vẫn thấy tên thật. |
| Chặn spam TPCN | `src/lib/spamGuard.ts` | Luật cứng theo cụm từ, khớp trên văn bản đã bỏ dấu. Bài rủi ro vào hàng chờ **kể cả khi tác giả là bác sĩ**; `posts.risk_score` quyết định thứ tự hàng chờ. |
| Xác thực bác sĩ | bảng `doctor_verifications` | Nộp giấy phép → admin duyệt → đặt `users.verified_at`, `role`, `specialty`, `workplace`. Chỉ admin duyệt được, moderator thì không. |
| SEO | `src/routes/sitemap.ts` | `/sitemap.xml` và `/robots.txt` phục vụ từ gốc site, nginx proxy sang backend. |

`assessContent()` là chỗ duy nhất cần sửa nếu sau này muốn chấm điểm bằng LLM
thay vì luật cứng.

## Known behaviour kept as-is

- `post_count` on `/tags/hot` counts rows in `post_tags`, not approved posts.
  `tags.py` joined posts with a status filter but counted `post_tags.post_id`,
  which the outer join cannot reduce. Numbers in the sidebar do not move.
- `comments.vote_count` is never written by any endpoint, so sorting by
  `popular` sorts a column of zeros. It is still returned because
  `CommentItem.tsx:26` renders it.
- The `/admin/moderation/posts*` aliases and the `PATCH` variants for users
  and reports are kept: `adminService.ts` calls them **first** and only falls
  back to the canonical paths in a `catch`.
- `UserRole.guest` is unused in both backend and frontend and is not in the
  TypeScript union, but the label stays in the Postgres enum type.
