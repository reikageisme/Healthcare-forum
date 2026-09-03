# Healthcare Forum — backend (TypeScript)

Hono + Drizzle + Zod on Node 20. The port preserves the former FastAPI JSON
contracts and PostgreSQL data model, then extends them with Vietnamese search,
accepted answers, anonymity, doctor verification, stories, SEO and a
three-level category tree. The frontend now consumes those additions too.

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

`entrypoint.sh` runs four steps before serving, all idempotent:
`createDatabase` (creates the database when the configured account has
permission), `migrate` (creates the schema only on a brand-new database and
applies patches), `sanitizeExisting` (cleans content stored before sanitising
existed), and `createAdmin`.

## Layout

| Path | What lives there |
| --- | --- |
| `src/db/schema.ts` | Current Drizzle tables and canonical lowercase PostgreSQL enums |
| `src/schemas/responses.ts` | Zod response builders — the only place a row becomes JSON |
| `src/schemas/requests.ts` | Input validation, replacing the Pydantic models |
| `src/core/` | config, JWT + bcrypt, the shared error handler |
| `src/middleware/` | auth, role guards, rate limiting |
| `src/routes/` | one file per former APIRouter |
| `src/lib/` | sanitising, slugify, cursor + batched post queries |
| `drizzle/0000_init.sql` | DDL for a fresh database |
| `drizzle/0001_*.sql`–`0004_*.sql` | Idempotent patches, applied on every boot |
| `drizzle/0006_site_settings.sql` | Idempotent network/footer settings table, applied on every boot |

The deployed database has canonical lowercase enums. G1 therefore requires
no enum-correction migration; the previously proposed `0005` has been removed.
Bootstrap no longer converts legacy uppercase labels. A noncanonical database
requires a separate schema audit and migration before application startup.
See the [G1 closure record](../docs/evidence/2026-09-03-g1-closure.md) for the
decision, regression coverage and verification limits.

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

**401 and 403 keep their meanings.** Missing or invalid credentials return
401 with a Bearer challenge. A deactivated account or an insufficient role
returns 403, so clients can distinguish credential expiry from denied access.

**Behaviour was ported as-is, except for security.** Where the two differ,
it is deliberate and listed below.

## Deliberate changes

| Change | Why |
| --- | --- |
| Post and comment HTML is sanitised on write | Both are rendered with `dangerouslySetInnerHTML`, including in the moderation preview — a member's post could run script inside a moderator's session, and the auth token lives in `localStorage` |
| One-off pass over existing rows | Content stored before this change is still in the database |
| Refresh tokens carry `type: "refresh"` and are required at `/auth/refresh` | Both tokens had identical payloads, so a leaked 30-minute access token could be traded for a 7-day refresh token, indefinitely |
| Bearer authentication requires `type: "access"`; both token kinds require expiry and a UUID subject | Rejects ambiguous legacy credentials and malformed claims before querying users |
| Each new token includes an issue time and a unique `jti` | Refreshes within the same second still return distinct token pairs |
| SQL logging is off unless `SQL_ECHO=true` | `echo=True` was hardcoded and logged every statement with its parameters |
| Rate limits on login, register, report and upload | There were none; report flooding is the cheapest way to bury the moderation queue |
| CORS reads real origins; `*` falls back to localhost | `allow_origins=["*"]` with `allow_credentials=True` is rejected by browsers and unsafe |
| `JWT_SECRET` under 32 chars refuses to boot in production | The default key was committed |
| The first admin needs `ADMIN_PASSWORD` | `create_admin.py` hardcoded `admin123` |
| Uploads are named from the format sharp detects, not the client's extension | The extension was taken on trust |
| `/uploads` is served with `nosniff` and a `default-src 'none'; sandbox` CSP | Stops a stored file being interpreted as a document |
| `GET /users/me/bookmarks` returns each post's real `status` | The Python response omitted it, so Pydantic defaulted every saved post to `pending` and `FeedCard` drew a review badge on all of them |
| Admin user list uses two grouped queries | It ran two queries per user |

## Authentication and token rollout (G2)

When this change is deployed, sessions with old untyped JWTs must sign in
again. There is no compatibility window for tokens missing `type` or `exp`.
Previously issued, unexpired typed tokens with valid UUID subjects continue
to work even without the new `iat` and `jti` claims. Database roles and active
state are checked on every authenticated request and refresh; invalid or
inactive credentials on optional-auth routes are treated as anonymous.

Refresh issues a distinct access/refresh pair while preserving configured
lifetimes. Renewal remains stateless: earlier typed refresh tokens can still
be used until expiry while the account remains active. Unique IDs do not add
single-use enforcement or server-side revocation.

Run `npm test -- tests/auth.test.ts` for the G2 auth gate. The
[G2 implementation evidence](../docs/evidence/2026-09-03-g2-auth.md) records
AUTH-01–09 coverage, the full backend results and the session cutover behavior.
The existing POLICY-01 production-rollout decision remains deferred.

## Category tree

Categories carry a `parent_id` and are capped at three levels: root → child →
grandchild. `GET /categories` stays a depth-first flat list with each branch
kept together, ordered by `sort_order` then name inside one level, so the admin
table, sidebar and post form build the tree from one response instead of a
second nested endpoint.

Opening a parent shows its own posts **plus everything under its children and
grandchildren**, and `post_count` follows the same rule. Reparenting checks both
cycles and resulting branch height. Deleting a parent leaves its children in
place as roots (the foreign key is `ON DELETE SET NULL`) rather than taking a
whole branch of the forum with it.

## Vietnamese forum features

| Thứ | Nằm ở đâu | Ghi chú |
| --- | --- | --- |
| Tìm không dấu | `posts.search_text` | Bản chữ thường, bỏ dấu của tiêu đề + tóm tắt + nội dung, ghi lúc lưu. Không cần extension nào của Postgres, và chữ `đ` được xử lý riêng vì NFD không tách nó. |
| Câu trả lời được chấp nhận | `posts.accepted_comment_id` | `PUT /posts/:id/accepted-answer`, chỉ tác giả hoặc staff. Bình luận được chọn luôn đứng đầu cây. |
| Đăng ẩn danh | `posts.is_anonymous`, `comments.is_anonymous` | Người đọc thấy một tác giả giả lập không mang id thật; tác giả và staff vẫn thấy tên thật. |
| Chặn spam TPCN | `src/lib/spamGuard.ts` | Luật cứng theo cụm từ, khớp trên văn bản đã bỏ dấu. Bài rủi ro vào hàng chờ **kể cả khi tác giả là bác sĩ**; `posts.risk_score` quyết định thứ tự hàng chờ. |
| Xác thực bác sĩ | bảng `doctor_verifications` | Nộp giấy phép → admin duyệt → đặt `users.verified_at`, `role`, `specialty`, `workplace`. Chỉ admin duyệt được, moderator thì không. |
| SEO | `src/routes/sitemap.ts` | `/sitemap.xml` và `/robots.txt` phục vụ từ gốc site, nginx proxy sang backend. |
| Story 24 giờ | `src/routes/stories.ts` | Gom theo tác giả, tự hết hạn, chỉ nhận ảnh nội bộ `/uploads`, có báo cáo và quyền gỡ của tác giả/staff. |

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
- The frontend now rotates access/refresh tokens and retries one failed request,
  but that flow still lacks a frontend automated-test gate.
- The frontend build passes, but ESLint, a frontend test script, a lockfile and
  CI workflows are still absent.
