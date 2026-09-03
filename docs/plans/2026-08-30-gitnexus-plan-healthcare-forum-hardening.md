# GitNexus Engineering Plan

> Task: Lên kế hoạch sửa toàn bộ lỗi runtime, security, API contract, frontend verification và Docker deployment đã phát hiện trong Healthcare Forum.
> Evidence verified at commit c9d8edb53761a0da4d879cd7f56472f66abbaa0e; GitNexus index not used. Fallback mode: no .gitnexus/index, no installed gitnexus CLI, and npx gitnexus failed during npm cleanup; all graph/PDG claims are omitted and findings below are source-derived.
> Evidence provenance schema 2; global dirty digest 1151c4ef469899c09c85d3d1b934975efd1778e08e8c578b69aed873d600fa53; cited-path manifest 76 sorted entries; exact generated plan path excluded. The Linux helper observed raw worktree layers as unstaged relative to Git blobs (consistent with Windows line-ending normalization); executor must re-anchor before editing.

## 0. Current-state reconciliation — 2026-09-01

> Current source anchor: `0de420b966a0180ad5a19b09e9e1a8b782725732` on `dev/healthcare-forum-hardening`.
> The original plan below remains a historical record pinned to `c9d8edb`; this section overrides its execution assumptions. Do not execute Python/FastAPI, SQLAlchemy, Alembic, `backend/app/**`, or `backend/tests/test_*.py` tasks without re-planning them against the TypeScript codebase.
> This reconciliation is source-derived. The mandatory descriptor-anchored Deepen helper could not safely re-pin the untracked plan on the OneDrive-backed Windows filesystem, so the original provenance header is intentionally preserved rather than falsely updated.

### What changed after the original anchor

The repository was first migrated from FastAPI/SQLAlchemy/Alembic to Hono,
TypeScript, Drizzle and Vitest/PGlite. The latest merged range
`2a6d34a..0de420b` then added or completed:

- first-boot database creation and idempotent Drizzle patches;
- Vietnamese diacritic-insensitive search, accepted answers, anonymous posts
  and comments, supplement-spam scoring, doctor verification and medical-safety
  UI;
- stories with a 24-hour lifetime, reporting and moderation;
- sitemap/robots routes and frontend SEO metadata;
- production upload and blank-post-page fixes, plus preservation of unfinished
  tags while editing;
- a depth-first, manually ordered category tree capped at three levels, with a
  Vietnamese medical-category seed script.

### Verified gates at the current anchor

| Gate | Current state | Current evidence and remaining work |
| --- | --- | --- |
| G1 — DB enum / async ORM | **Superseded; runtime migration still needs smoke** | SQLAlchemy enum and `MissingGreenlet` work no longer applies. Drizzle uses lowercase PostgreSQL enums and `migrate.ts` baselines an existing schema before applying idempotent patches. No live legacy PostgreSQL copy was exercised in this refresh. |
| G2 — backend auth | **Complete for current backend** | Access/refresh token separation, UUID subject validation, database-backed roles and inactive-account semantics are implemented in `backend/src/core/security.ts` and `backend/src/middleware/auth.ts`; security tests pass. |
| G3 — frontend auth | **Partial** | Registration now calls `/auth/register`, but `authStore.ts` persists only the access token and `lib/api.ts` still logs out on the first non-auth 401; single-flight refresh/retry remains open. |
| G4 — unified visibility | **Open** | Feed and pending-detail probes have coverage, but approved unpublished detail is not rejected and comments/reactions/bookmarks still use existence-only `findPostOr404`; bookmark listing filters publication but not approval status. |
| G5 — stored HTML | **Backend complete; defense-in-depth open** | Posts/comments are sanitized on write, old rows have `sanitizeExisting`, and backend XSS tests pass. A frontend render sanitizer and representative legacy-content/runtime smoke remain open. |
| G6 — tag aggregation | **Open** | `backend/src/routes/tags.ts` still counts `post_tags.post_id` after an outer join; `backend/README.md` documents the known incorrect public count. |
| G7 — report moderation | **Backend complete; frontend open** | The backend atomic content action resolves all matching reports and is tested. `AdminReportsPage.tsx` still deletes the target and resolves the report in two requests instead of calling `deleteReportContent(reportId)`. |
| G8 — frontend quality | **Partial** | `npm run build` passes. `npm run lint` cannot find ESLint, there is no frontend `test` script or lockfile, and the production bundle emits a >500 kB chunk warning. |
| G9 — uploads | **Implemented; proxy smoke pending** | Backend upload validation tests pass and Vite/Nginx proxy `/uploads`; a live dev/prod retrieval smoke was not run in this docs refresh. |
| G10 — config / Docker | **Partial** | `createDatabase → migrate → sanitizeExisting → createAdmin` is wired in the entrypoint and all three Compose configurations parse. Full container startup, legacy DB migration and rollback were not exercised; `docker-compose.db.yml` still defaults/comments the old `healthcare_forum` database name. |
| G11 — CI / release | **Open** | No `.github` workflow, frontend test gate, full product smoke, or rollback evidence exists in the current tree. |
| New Vietnamese/forum scope | **Backend verified** | The five Vitest files pass 82/82 tests, including three-level categories, Vietnamese search, accepted answers, anonymity, spam scoring, doctor verification, stories, security and bootstrap behavior. Frontend component/E2E coverage is still absent. |

Verification captured on 2026-09-01:

- `cd backend && npm test`: **PASS**, 5 files and 82 tests;
- `cd backend && npm run typecheck`: **PASS**;
- `cd frontend && npm run build`: **PASS**, with a 1,223.19 kB main-chunk warning;
- `cd frontend && npm run lint`: **FAIL**, ESLint executable/config absent;
- `cd frontend && npm test -- --run`: **FAIL**, `test` script absent;
- dev, prod-overlay and container-DB-overlay `docker compose ... config --quiet`: **PASS**.

### Rebased implementation sequence

1. Finish G3 by persisting the refresh token and implementing one guarded,
   single-flight refresh/retry path with auth-endpoint exclusions.
2. Finish G4 by replacing existence-only post lookup with one visibility and
   interaction policy used by detail, comments, reactions and bookmarks; add
   approved-unpublished and pending/rejected matrix tests.
3. Finish G6 and G7 by counting filtered `posts.id` and routing the report UI
   through the single atomic backend endpoint.
4. Finish G8/G11 with a committed frontend lockfile, ESLint configuration,
   Vitest component/service suites and CI gates for backend typecheck/tests and
   frontend lint/build/tests.
5. Close G9/G10 with live upload retrieval, fresh and legacy PostgreSQL,
   production-secret, startup/restart and rollback smokes; reconcile the
   remaining `health` versus `healthcare_forum` defaults.
6. Add frontend tests for stories, doctor verification, anonymity, medical
   safety, SEO and the three-level category UI before calling the newly merged
   product scope release-ready.

The detailed historical catalog below remains useful for intent and adversarial
scenarios, but all filenames, commands and implementation steps must be mapped
to the current TypeScript paths and the status table above before execution.

## 1. Objective

[verified] Deliver an implementation-ready hardening plan for the current repository, not an implementation. The requested outcome is a coherent full-stack repair that makes the documented Phase 1–3 product behavior executable and verifiable.

[inferred] Prioritize P0 correctness/security first, then contract/build/deployment reliability, then CI and deferred operational hardening. Preserve the existing product model: public approved content, private pending/rejected visibility for the owner/staff, admin/moderation workflows, and same-origin frontend proxies.

Acceptance gates:

- Backend authentication, visibility, enum, HTML, tag-count, report-action and async-session regressions are covered by tests.
- Frontend registration, refresh/retry, admin report deletion, route protection, asset proxying and HTML rendering match backend contracts.
- Frontend strict TypeScript build, ESLint, Vitest and dependency installation are reproducible.
- Fresh PostgreSQL migration and Docker startup are safe, idempotent and documented.
- No source/test/config file is modified during planning; only this plan document is published.

## 2. Current Behaviour

[verified] backend/app/main.py:31-53 installs permissive CORS, mounts /uploads, and includes auth, content, community, report and admin routers under /api/v1; backend/app/core/database.py:5-6 creates an async engine with SQL echo enabled.

[verified] backend/app/models/post.py:29-35, backend/app/models/reaction.py:22, and backend/app/models/report.py:23-28 use SQLAlchemy Enum columns whose Python member names are uppercase for several enums, while 0001/0002 migrations create lowercase PostgreSQL labels (backend/alembic/versions/0001_phase2_content_community.py:76-80,124 and backend/alembic/versions/0002_phase3_admin_moderation.py:24-46).

[verified] get_current_user decodes JWT sub as a string and passes it directly into UUID-column queries (backend/app/api/deps.py:19-31). The test fixture creates UUID-backed users but puts string UUIDs into tokens (backend/tests/conftest.py:117-133).

[verified] get_post_detail allows any existing approved post without checking is_published, increments view_count, commits, then reads server-managed updated_at (backend/app/api/v1/posts.py:392-448). The observed test failure is MissingGreenlet at that post-commit attribute read.

[verified] list_posts applies is_published globally and filters public status, but comments/reactions/bookmarks use separate bare find_post functions; bookmark retrieval filters is_published but not status (backend/app/api/v1/posts.py:219-243, backend/app/api/v1/comments.py:19-30, backend/app/api/v1/reactions.py:17-27, backend/app/api/v1/bookmarks.py:40-50,84-93).

[verified] get_hot_tags and get_tag outer-join filtered Post rows but count post_tags.post_id, so an association can be counted even when its post fails the approved/published join (backend/app/api/v1/tags.py:18-24,59-73). A direct source-level smoke case with one approved and one pending association returned count 2.

[verified] LoginPage calls /users/ for registration (frontend/src/pages/LoginPage.tsx:49-60), while the backend exposes POST /auth/register (backend/app/api/v1/auth.py:12-31); following the redirect produced 405 Method Not Allowed.

[verified] frontend/src/lib/api.ts:19-27 logs out and redirects every 401 without refresh-token handling. frontend/src/stores/authStore.ts:8-16 persists only one token, and LoginPage temporarily stores a fake user before calling /auth/me (frontend/src/pages/LoginPage.tsx:27-40).

[verified] AdminReportsPage deletes content by target type and then separately resolves the report (frontend/src/pages/admin/AdminReportsPage.tsx:72-89), although the backend already provides one atomic target-action endpoint that resolves all open reports (backend/app/api/v1/admin.py:559-620). adminService also uses broad catch-all fallbacks around mutations (frontend/src/services/adminService.ts:19-49,65-117).

[verified] Raw HTML is rendered through dangerouslySetInnerHTML in the post detail and moderation preview (frontend/src/pages/PostDetailPage.tsx:259-263, frontend/src/pages/admin/AdminModerationPage.tsx:408-411), while backend post create/update persist content without sanitizer. PostSummaryResponse has no content field (backend/app/schemas/post.py:68-93), so the moderation preview can receive no body.

[verified] Upload responses are relative /uploads/... URLs (backend/app/api/v1/upload.py:75-80), but Vite and Nginx proxy only /api (frontend/vite.config.ts:12-18, frontend/nginx.conf:21-34).

[verified] Verification baseline: Python compileall passed; backend pytest after installing requirements in a temporary venv reported 42 failed and 5 passed, dominated by the UUID mismatch, with a separate MissingGreenlet post-detail failure; npm run build reported 28 strict TypeScript unused-symbol/state errors; npm run lint could not find eslint; npm test has no script; Docker Compose failed before startup because env_file: .env is mandatory although README calls .env optional (docker-compose.yml:23-56, README.md:28-41).

## 3. Relevant Architecture

[verified] The domain boundary is FastAPI routers → dependency-injected AsyncSession → SQLAlchemy models/relationships → Pydantic response schemas. Users own posts/comments/reactions/bookmarks; posts relate to categories/tags and carry both moderation status and publication is_published.

[verified] The frontend boundary is React Router pages/components → typed service modules → one Axios client with persisted Zustand auth. Admin routes are nested under /admin and guarded by AdminRouteGuard plus AdminOnlyGuard (frontend/src/App.tsx:75-101, frontend/src/components/admin/AdminRouteGuard.tsx:9-21, frontend/src/components/admin/AdminOnlyGuard.tsx:9-16).

[verified] PostgreSQL is the intended runtime database and SQLite is used by the async test fixture (README.md:5-12, backend/tests/conftest.py:22-35). Alembic owns schema creation; Docker currently starts Uvicorn directly and does not run alembic upgrade head (backend/Dockerfile:17-25, docker-compose.yml:23-41).

[inferred] The safest repair pattern is to centralize cross-router policies—UUID/token parsing, post access, and HTML sanitization—then make each route call those policies. This avoids fixing the public feed while leaving detail/comments/reactions/bookmarks as alternate data paths.

## 4. GitNexus Findings

GitNexus was unavailable, so there are no graph-derived callers, impact depths, process resources or PDG edges in this plan. The following is the bounded source-derived substitute.

- [verified] get_current_user is the shared authentication dependency used by require_role and authenticated route parameters in backend/app/api/deps.py:13-64; changing it affects all authenticated routers, so UUID parsing and token-kind behavior must be backward-considered.
- [verified] create_post, list_posts, get_post_detail, and update_post form the post lifecycle in backend/app/api/v1/posts.py:118-202,205-361,364-455,459-568; status/publication changes feed detail, moderation, comments, reactions, bookmarks, tags and admin counts.
- [verified] The duplicated find_post functions in comments, reactions and bookmarks (backend/app/api/v1/comments.py:19-29, backend/app/api/v1/reactions.py:17-27, backend/app/api/v1/bookmarks.py:40-50) are the direct source-derived policy fan-out for visibility.
- [verified] get_hot_tags/get_tag consume PostStatus and is_published but count the association table (backend/app/api/v1/tags.py:15-85); the direct consumer is the public sidebar/tag page through the tag service.
- [verified] delete_reported_content is already the backend convergence point for post/comment/user removal and report resolution (backend/app/api/v1/admin.py:559-620); the frontend currently bypasses it.
- [verified] api is imported by all frontend service modules, while useAuthStore is read by the request interceptor and useAuth; LoginPage, admin pages and report components are visible callers (frontend/src/lib/api.ts:1-28, frontend/src/stores/authStore.ts:1-19, frontend/src/services/adminService.ts:1-129).
- [inferred] No graph means direct-dependent accounting is source-bounded rather than exhaustive. Before implementation, run GitNexus indexing in a Linux-capable environment if a formal impact report is required; do not treat this fallback list as a substitute for a fresh graph.

## 5. Statement-Level PDG Findings

No PDG layer was available because the repository has no GitNexus index and the analyzer could not be resolved. The following bounded control/data observations are source-derived only.

| Central symbol | Control/data/state observation | Planning consequence |
| --- | --- | --- |
| get_current_user (backend/app/api/deps.py:19-31) | Decode token → read sub → query UUID column → active-user branch; current sub is not parsed. | Parse with UUID, convert malformed values to 401, and reuse the same helper for optional auth; do not trust JWT role for authorization. |
| get_post_detail (backend/app/api/v1/posts.py:392-455) | Query post/relationships → status-only visibility branch → mutate view_count → commit → read updated_at and relationship-backed response fields. | Add is_published to the access predicate and explicitly refresh/requery after commit to prevent implicit async IO. |
| list_posts (backend/app/api/v1/posts.py:219-243,278-329) | Base is_published filter is applied before author/staff status branching; user reactions/bookmarks are fetched after result selection. | Move visibility into a shared matrix so private owner/staff lists and public lists are intentional; keep cursor ordering unchanged. |
| get_hot_tags (backend/app/api/v1/tags.py:18-24) | Outer join has post predicates in the ON clause but count uses association-table ID. | Count Post.id (and order by the same expression), with a regression containing non-public associations. |
| delete_reported_content (backend/app/api/v1/admin.py:571-613) | Target mutation → loop over all open reports for target → current report mutation → one commit. | Frontend must call this endpoint once; preserve one transaction and add missing-target/idempotency tests. |
| api response interceptor (frontend/src/lib/api.ts:19-27) | Every 401 immediately clears state; no exclusion for login/refresh and no replay guard. | Add retry/auth-endpoint exclusion and single-flight refresh; only logout after refresh failure. |

No manually reconstructed graph edges are claimed. A later executor should run analyze --index-only --pdg if statement-level proof is needed.

## 6. Proposed Changes

### 6.1 P0 — Normalize enum storage and async transaction boundaries

- Files/symbols: backend/app/models/user.py:User.role, post.py:Post.post_type/Post.status, reaction.py:Reaction.reaction_type, report.py:Report.status/Report.target_type.
- Change: configure every SQLAlchemy Enum with explicit name and values_callable that stores member .value, preserving lowercase labels already defined by the migrations. Keep Pydantic validators accepting lowercase client payloads.
- Migration: do not rewrite shared 0001/0002. Add backend/alembic/versions/0003_enum_value_alignment.py only if the database audit finds an existing Base.metadata.create_all/uppercase enum deployment; make it inspect pg_enum, rename only known uppercase labels when the lowercase target is absent, and fail with a diagnostic if both labels coexist. Fresh Alembic databases should be a no-op.
- Change get_post_detail so the view_count update is followed by await db.refresh(post) or a relationship-aware requery before reading updated_at; prefer a single explicit requery that returns the committed scalar and selectin-loaded relationships.
- Keep expire_on_commit=False, but never rely on it to guarantee server-on-update fields remain loaded.
- Add a PostgreSQL migration smoke test and a regression for two detail reads. Do not change cursor ordering or counter semantics.

### 6.2 P0 — Harden JWT, UUID and session lifecycle

- Files/symbols: backend/app/core/security.py, backend/app/api/deps.py:get_current_user/get_optional_current_user, backend/app/api/v1/auth.py:login/register/refresh, backend/app/schemas/user.py:TokenPayload, new frontend/src/services/authService.ts, frontend/src/stores/authStore.ts, frontend/src/lib/api.ts, frontend/src/pages/LoginPage.tsx.
- Backend token claims: add a claim such as type=access|refresh; require access in get_current_user and refresh in refresh. Keep role in the token for display/compatibility only; authorization remains database-backed.
- Parse payload sub with UUID(...); malformed/missing values become the existing 401 credential error. Optional auth returns None rather than raising or leaking a 500.
- Reject inactive users in both login and refresh. Preserve a consistent status/detail contract and add tests for inactive and malformed-token paths.
- Decide and document session rollout: typed claims invalidate old untyped sessions and force login, or implement a short compatibility window only if deployment requires it. Recommended default is explicit forced re-login rather than accepting ambiguous tokens.
- Add typed frontend auth service methods for login/register/refresh/me. Extend the auth state with refreshToken and atomic session/clear actions; migrate old persisted state safely.
- Replace the fake temporary user in LoginPage with a typed token handoff. Register through /auth/register; preserve the current register-then-sign-in UX unless product chooses auto-login.
- Implement a response interceptor with: skip refresh for /auth/login, /auth/register, /auth/refresh; one shared refresh promise for concurrent 401s; retry marker on the original request; replay with the new access token; logout and redirect to /login with the original path only after refresh failure. Never retry a 401 indefinitely.

### 6.3 P0 — Centralize post visibility and apply it to every content path

- Add backend/app/services/post_access.py with a documented matrix:
  - public: status=approved AND is_published=true;
  - owner/staff: may inspect pending/rejected/private posts;
  - unrelated users/anonymous: 404 for non-public posts;
  - community interactions on non-public posts: deny by default; allow only if the explicit product decision says owner/staff may interact.
- Update posts.py list/detail/update paths to call the helper. In list queries, do not apply a public is_published filter before determining whether the request is an owner/staff private query.
- Update comments.py to inject optional current user for reads and require visibility for reads/writes; retain cross-post parent validation and reject hidden post access.
- Update reactions.py and bookmarks.py to require visibility for both read and write paths. get_my_bookmarks must filter both approved status and published flag, so removed/rejected posts disappear from the public bookmark feed.
- Preserve 404 for hidden content to avoid existence disclosure. Add matrix tests for anonymous, unrelated user, owner, moderator and admin.
- Do not let the helper change post ownership/edit permissions; those remain explicit route checks.

### 6.4 P0 — Sanitize HTML at the trust boundary and at render sinks

- Add backend/app/services/content_sanitizer.py and a pinned sanitizer dependency in backend/requirements.txt.
- Allow only the tags needed by TipTap (p, headings 1–3, emphasis/strong/strike, lists, blockquote, code/pre, br, a, img) and only safe attributes. Permit http/https plus the application-relative /uploads/ path; reject javascript:, data:, event-handler attributes, inline executable styles and unsafe URL schemes.
- In create_post and update_post, sanitize before persistence and before generating excerpts. Reject content whose visible text becomes empty/too short after cleaning. Validate thumbnail URLs with the same scheme policy.
- Sanitize existing content on response as defense-in-depth until a one-time backfill is completed. Cover detail, admin preview and any future full-content response; do not rely on strip_html_and_truncate as a sanitizer.
- Add frontend/src/lib/sanitizeHtml.ts with a browser sanitizer and use it at PostDetailPage and moderation preview. Keep server sanitization mandatory because other API clients can bypass the browser.
- Fix moderation preview correctness: either fetch the full sanitized post detail when opening preview (recommended, avoiding a list payload expansion) or introduce a typed moderation-detail schema that includes sanitized content. Test that preview is populated and safe.

### 6.5 P1 — Correct tag aggregation and preserve public counts

- In backend/app/api/v1/tags.py:get_hot_tags/get_tag, replace count(post_tags.c.post_id) and its ordering expression with count(Post.id) or an equivalent filtered distinct post count. Keep the approved/published predicates in the join/filter.
- Add test data with approved, pending, rejected and unpublished posts sharing the same tag; assert only approved published posts contribute.
- Verify category aggregation remains aligned with its existing count(Post.id) pattern and does not regress.

### 6.6 P1 — Make report moderation atomic end-to-end

- Keep backend/app/api/v1/admin.py:delete_reported_content as the single mutation endpoint for post/comment/user targets; add explicit behavior/tests for already removed targets and all open reports on the same target.
- In frontend/src/services/adminService.ts, remove deleteViolatingContent and broad mutation fallbacks. Use one canonical list/action contract (/admin/posts, /admin/posts/{id}/approve|reject, PUT /admin/reports/{id}, DELETE /admin/reports/{id}/content), and surface 4xx/5xx errors instead of trying a second mutation.
- In AdminReportsPage and ReportActionModal, pass only report ID to the delete-content callback, call deleteReportContent once, then refetch. Do not separately resolve after the atomic endpoint.
- Model dismissed as a closed state distinct from resolved; prevent actions intended only for open reports. Update frontend types to match backend enum values and show target metadata safely.
- Add service/component tests that assert exact request count and endpoint, including user-target reports.

### 6.7 P1 — Repair frontend routing, build and verification

- Fix the 28 compiler errors reported by npm run build by removing genuinely unused imports/locals or wiring already-intended state; keep strict, noUnusedLocals and noUnusedParameters enabled. Do not blanket-disable checks.
- For AdminDashboardPage, AdminModerationPage, AdminReportsPage and AdminUsersPage, either render the existing loading/total/page state or remove dead state. Recommended: add a small shared PaginationControls and use the existing server pagination contract.
- Use the currently unused auth values in EditPostPage to redirect unauthenticated users to /login with a return location; backend ownership checks remain authoritative.
- Add ESLint and a checked-in config compatible with the existing script (eslint 8-style config is the least disruptive because the script passes --ext). Add only the React/TypeScript rules needed for this codebase; make lint fail on warnings.
- Add Vitest scripts and focused tests for auth retry, register path, sanitizer, admin report deletion and route guards. Add only the test libraries required by those tests.
- Generate and commit frontend/package-lock.json; switch Docker frontend installation from npm install to npm ci. Run npm audit after the lockfile exists; treat --force as a deliberate dependency migration, not an automatic fix.

### 6.8 P1 — Fix asset proxy and same-origin behavior

- Add a Vite proxy entry for /uploads to http://backend:8000.
- Add location ^~ /uploads/ in frontend/nginx.conf before/alongside the regex static location. ^~ is required because the existing regex for .png/.jpg/.gif/.svg can otherwise win and serve from the frontend root.
- Keep API and upload URLs relative so dev and production share the same browser contract. Add a smoke check that an uploaded image URL is retrievable through port 3000.

### 6.9 P1 — Make configuration and Docker startup safe

- backend/app/core/config.py: add explicit environment mode, default CORS to localhost rather than *, add DB_ECHO=false, and fail fast in production when JWT secret/database/CORS configuration is missing or still using a development default.
- backend/app/core/database.py: use settings.DB_ECHO; production logs must not emit SQL by default.
- Add backend/docker-entrypoint.sh: set -eu, run alembic upgrade head, then exec "$@". Keep migrations idempotent and let Compose database health determine readiness.
- Update backend/Dockerfile to copy/chmod the entrypoint and use it for dev/prod; preserve the Uvicorn command supplied by each stage/Compose override.
- Update docker-compose.yml: make .env optional for dev (or remove the unused frontend env file), keep safe defaults for local development, interpolate the configured Postgres user/database in the healthcheck, and remove obsolete version.
- Update docker-compose.prod.yml: require DATABASE_URL, JWT_SECRET, BACKEND_CORS_ORIGINS and production mode through Compose variable checks; keep Adminer disabled.
- Replace hardcoded admin123 in create_admin.py with required environment/CLI inputs and the shared password hasher. Never seed an admin silently during container startup.
- Update README with exact dev/prod env rules, automatic migrations, intentional admin creation, health/smoke URLs and rollback guidance. Update .env.example to distinguish dev placeholders from production secrets.

### 6.10 P2 — Add merge gates and release verification

- Add .github/workflows/ci.yml with backend dependency/test and frontend npm ci/lint/build/test jobs; add PostgreSQL migration coverage as a service/container job.
- Add an integration smoke script or documented commands that exercise register → login → create pending post → moderator approve → public feed/detail → comment/reaction/bookmark → report → atomic delete.
- Record expected status codes and response fields from PROJECT.md; remove compatibility aliases only after callers are migrated.
- Keep N+1 optimization, object storage, rate limiting, email notifications, persistent comment voting and full browser E2E outside this fix unless product explicitly expands scope.


### 6.11 Implementation task-group map

| Group | Scope | Blocking dependencies | Can run in parallel with | Exit gate |
| --- | --- | --- | --- | --- |
| G0 | Baseline, DB lineage, policy decisions | none | none | Decisions/evidence recorded |
| G1 | Enum storage + async ORM | G0 | G2 | DB-ENUM/DB-MIG/DB-ASYNC pass |
| G2 | Backend auth + UUID/token lifecycle | G0 | G1 | AUTH-01..09 pass |
| G3 | Frontend auth + route guards | G2 | G6, G7 | FEAUTH-01..09 pass |
| G4 | Shared post visibility | G1, G2, T0.3 | G6, G7 | VIS-01..08 pass |
| G5 | HTML sanitization + safe preview | G1, G4 | none (overlaps posts/UI) | XSS-01..10 pass |
| G6 | Tag aggregation | G1 | G3, G4, G7 | TAG-01..03 pass |
| G7 | Atomic report moderation | G1, G2 | G3, G4, G6 | REP/FEREP pass |
| G8 | Frontend build/lint/test/pagination | G3, G7 | none | FEQ-01..06 pass |
| G9 | Upload proxies | G8 | none | UP-01..05 pass |
| G10 | Secure config + Docker bootstrap | G1, G2, G9 | none | OPS-01..07 pass |
| G11 | CI, full smoke, release gate | G5–G10 complete | none | CI/E2E/REL pass |

[inferred] Recommended integration order is G0 → (G1 || G2) → (G3 || G4 || G6 || G7, respecting listed dependencies) → G5 → G8 → G9 → G10 → G11. Keep overlapping edits to posts.py, adminService.ts and package.json serialized even when their groups are otherwise parallel.

## 7. Implementation Backlog and Sequence

Execution rules:

- One task ID is one reviewable unit; prefer one atomic Conventional Commit per task or tightly coupled pair.
- A task may start only when its listed dependency gate is green.
- Run the listed task-level test IDs before committing; run the group gate before merging that group.
- Do not regenerate lockfiles, snapshots or deployment artifacts repeatedly in intermediate tasks; do them once in the owning group.
- Status starts as [ ] pending. Mark [x] only when code, tests and gate evidence are present.

### G0 — Baseline and decision gates

Dependency: none. This group blocks all implementation.

#### T0.1 — Re-anchor baseline and preserve failing evidence

- [ ] Record HEAD, source/staged/untracked status and exact tool/runtime versions.
- [ ] Reproduce backend pytest, frontend build/lint/test and Compose config outcomes in a clean environment.
- [ ] Save concise failure signatures: UUID StatementError, MissingGreenlet, 28 TypeScript errors, missing ESLint/test script, missing .env.
- Test IDs: BASE-01, BASE-02.
- Gate: baseline is reproducible without modifying source.

#### T0.2 — Inspect deployed database lineage

- [ ] Query alembic_version.
- [ ] Query pg_type/pg_enum for userrole, posttype, poststatus, reactiontype, reportstatus and reporttargettype.
- [ ] Determine whether production was created by Alembic or Base.metadata.create_all.
- [ ] Decide whether 0003 corrective migration is required; attach evidence.
- Test ID: DB-LEGACY-01.
- Gate: migration path is chosen from observed schema, not assumption.

#### T0.3 — Approve behavioral policies

- [ ] Confirm whether owner/staff may mutate comments/reactions/bookmarks on pending/rejected/unpublished posts.
- [ ] Confirm forced re-login when token kind is introduced.
- [ ] Approve sanitizer package/version, TipTap allowlist and legacy backfill method.
- [ ] Decide whether PostgreSQL CI is required per merge.
- Test/decision ID: POLICY-01.
- Gate: all questions required by G2/G4/G5/G11 are resolved.

### G1 — Database enum and async ORM correctness

Dependency: G0. May run in parallel with G2 after G0.

#### T1.1 — Map SQLAlchemy enums to lowercase values

- [ ] Add explicit enum names and values_callable for UserRole, PostType, PostStatus, ReactionType, ReportStatus and ReportTargetType.
- [ ] Preserve API lowercase serialization and existing schema validators.
- [ ] Add unit/ORM roundtrip coverage for every member.
- Test IDs: DB-ENUM-01, DB-ENUM-02.
- Gate: targeted enum tests pass on SQLite and PostgreSQL.

#### T1.2 — Implement conditional legacy enum migration

- [ ] If T0.2 proves canonical Alembic schema only, document 0003 as unnecessary and do not create a fake migration.
- [ ] If legacy uppercase labels exist, add 0003_enum_value_alignment.py.
- [ ] Make canonical lowercase schema a no-op.
- [ ] Rename only known uppercase labels when lowercase equivalent is absent.
- [ ] Fail clearly when both uppercase and lowercase labels coexist.
- [ ] Add upgrade and rollback/runbook tests against disposable PostgreSQL.
- Test IDs: DB-MIG-01, DB-MIG-02, DB-MIG-03.
- Gate: fresh and observed legacy schemas have a safe, tested path.

#### T1.3 — Remove implicit async IO from post detail

- [ ] After view_count commit, explicitly refresh or requery scalar fields and selectin-loaded relationships.
- [ ] Ensure response construction performs no lazy DB IO.
- [ ] Preserve one increment per successful detail request.
- Test IDs: DB-ASYNC-01, DB-ASYNC-02.
- Gate: post detail test passes twice with no MissingGreenlet.

Suggested commits: fix(db): align enum persistence; fix(posts): refresh detail after view update.

### G2 — Backend authentication and token lifecycle

Dependency: G0. May run in parallel with G1.

#### T2.1 — Add token-kind claims

- [ ] Emit type=access and type=refresh.
- [ ] Require access type in authenticated dependencies.
- [ ] Require refresh type in /auth/refresh.
- [ ] Keep database role as authorization source.
- Test IDs: AUTH-03, AUTH-06, AUTH-07.

#### T2.2 — Parse JWT subject as UUID

- [ ] Centralize sub extraction and UUID conversion.
- [ ] Convert missing/malformed sub to the credential error.
- [ ] Make optional auth return None for invalid tokens without 500.
- Test IDs: AUTH-05, AUTH-09.

#### T2.3 — Enforce inactive-account checks

- [ ] Reject inactive login.
- [ ] Reject inactive refresh.
- [ ] Preserve current authenticated-action inactive behavior.
- Test IDs: AUTH-04, AUTH-08.

#### T2.4 — Add auth test module

- [ ] Cover register success/duplicate, login, token kinds, malformed sub, invalid token kind, rotation and inactive user.
- [ ] Run in isolation and full suite.
- Test IDs: AUTH-01..AUTH-09.
- Group gate: all AUTH tests pass and existing admin RBAC tests remain green.

Suggested commit: fix(auth): validate token kind, uuid subject, and active state.

### G3 — Frontend authentication and route guards

Dependency: G2.

#### T3.1 — Create typed authService

- [ ] Implement register/login/me/refresh methods.
- [ ] Model token response and errors in frontend types.
- [ ] Replace direct auth calls in LoginPage.
- Test IDs: FEAUTH-01, FEAUTH-02.

#### T3.2 — Persist an atomic session

- [ ] Store user, access token and refresh token together.
- [ ] Add session update/rotation and clear actions.
- [ ] Migrate old auth-storage safely.
- Test ID: FEAUTH-02.

#### T3.3 — Add single-flight refresh/retry

- [ ] Exclude login/register/refresh endpoints from refresh logic.
- [ ] Share one refresh promise across concurrent 401s.
- [ ] Mark and replay each original request at most once.
- [ ] Clear session and redirect only after refresh failure.
- Test IDs: FEAUTH-03..FEAUTH-06.

#### T3.4 — Correct registration and navigation guards

- [ ] Register through /auth/register.
- [ ] Remove fake temporary user.
- [ ] Redirect anonymous /admin and edit-post routes to /login with return path.
- [ ] Preserve role-based admin/admin-only behavior.
- Test IDs: FEAUTH-01, FEAUTH-07..FEAUTH-09.
- Group gate: FEAUTH-01..09 pass; auth UX works manually.

Suggested commit: fix(frontend-auth): align registration and refresh lifecycle.

### G4 — Unified post visibility policy

Dependencies: G1, G2 and T0.3. G6/G7 can proceed in parallel on non-overlapping files.

#### T4.1 — Implement post_access policy

- [ ] Encode public read, private read and interaction eligibility separately.
- [ ] Return 404 for hidden content to unrelated actors.
- [ ] Return the approved policy status for visible-but-noninteractive owner/staff requests.
- [ ] Document actor/state matrix in code tests, not comments alone.
- Test IDs: VIS-01, VIS-08.

#### T4.2 — Apply policy to post list/detail

- [ ] Remove unconditional public filter from owner/staff list path.
- [ ] Preserve cursor order and public approved+published filter.
- [ ] Reuse policy in detail lookup.
- Test IDs: VIS-01, VIS-07, DB-ASYNC-01.

#### T4.3 — Apply policy to comments

- [ ] Inject optional current user for reads.
- [ ] Check visibility before returning a tree.
- [ ] Check interaction eligibility before create/reply.
- [ ] Preserve parent belongs-to-post validation.
- Test IDs: VIS-02, VIS-04.

#### T4.4 — Apply policy to reactions

- [ ] Check read visibility before returning counts.
- [ ] Check interaction eligibility before toggle.
- [ ] Preserve tri-state reaction behavior and helpful_count update.
- Test IDs: VIS-03, VIS-05.

#### T4.5 — Apply policy to bookmarks

- [ ] Check interaction eligibility before add/remove as decided by T0.3.
- [ ] Filter bookmark feed by approved+published.
- [ ] Define removal behavior when an existing bookmark becomes hidden.
- Test ID: VIS-06.

#### T4.6 — Build the complete matrix suite

- [ ] Cover anonymous, unrelated user, owner, moderator and admin.
- [ ] Cover approved+published, pending, rejected and approved+unpublished.
- [ ] Exercise detail, comments, reactions, bookmarks and list filters.
- Test IDs: VIS-01..VIS-08.
- Group gate: all visibility tests and existing posts/comments/reactions/bookmarks tests pass.

Suggested commit: fix(content): enforce one post visibility matrix.

### G5 — Stored HTML and render-sink safety

Dependencies: G1 and G4. Serialize with other posts.py/UI edits.

#### T5.1 — Define backend sanitizer

- [ ] Pin sanitizer dependency.
- [ ] Implement TipTap tag/attribute/protocol allowlist.
- [ ] Permit http/https and relative /uploads paths.
- [ ] Reject script, event handlers, javascript:, data: and unsafe style.
- Test IDs: XSS-01..XSS-05.

#### T5.2 — Sanitize create/update

- [ ] Sanitize before excerpt generation and persistence.
- [ ] Validate visible content after cleaning.
- [ ] Preserve old value if an update is rejected.
- Test IDs: XSS-06, XSS-07.

#### T5.3 — Protect legacy rows

- [ ] Sanitize full-content responses until backfill is complete.
- [ ] Implement one-time data migration only after sample review.
- [ ] Prove unsafe existing rows never reach clients.
- Test ID: XSS-08.

#### T5.4 — Add frontend defense-in-depth

- [ ] Add sanitizeHtml utility.
- [ ] Sanitize PostDetail render sink.
- [ ] Test dangerous and allowed markup.
- Test ID: XSS-09.

#### T5.5 — Repair moderation preview

- [ ] Fetch full detail on preview open instead of relying on PostSummaryResponse.
- [ ] Add loading/error/close handling.
- [ ] Sanitize preview output.
- Test ID: XSS-10.
- Group gate: XSS-01..10 pass and representative TipTap content renders correctly.

Suggested commits: fix(security): sanitize stored post html; fix(admin): load safe moderation preview.

### G6 — Public tag aggregation

Dependency: G1.

#### T6.1 — Count filtered Post rows

- [ ] Change both count and order expressions to Post.id or equivalent filtered count.
- [ ] Preserve tags with zero public posts.
- [ ] Keep deterministic secondary name sort.
- Test IDs: TAG-01..TAG-03.

#### T6.2 — Extend aggregation tests

- [ ] Create mixed-state posts sharing tags.
- [ ] Assert count and ordering.
- [ ] Re-run category count tests.
- Test IDs: TAG-01..TAG-03.
- Group gate: tag/category suites pass.

Suggested commit: fix(tags): count only approved published posts.

### G7 — Atomic report moderation

Dependencies: G1 and G2.

#### T7.1 — Harden backend content action

- [ ] Keep target mutation and report closure in one transaction.
- [ ] Cover post, comment and user targets.
- [ ] Define idempotent already-absent behavior.
- [ ] Resolve every open report for the target with one resolver/note.
- [ ] Preserve moderator/admin RBAC.
- Test IDs: REP-01..REP-06.

#### T7.2 — Remove frontend mutation fallbacks

- [ ] Use one canonical endpoint per action.
- [ ] Delete deleteViolatingContent.
- [ ] Surface the first request error; do not issue a fallback mutation.
- Test ID: FEREP-01.

#### T7.3 — Update report state UI

- [ ] Pass only report ID to delete-content handler.
- [ ] Do not call resolve separately after atomic delete.
- [ ] Render open/resolved/dismissed distinctly.
- [ ] Disable mutation controls for closed reports.
- Test IDs: FEREP-01, FEREP-02.

#### T7.4 — Add report regression suites

- [ ] Add backend target/state/RBAC tests.
- [ ] Add frontend exact-request-count/state tests.
- Test IDs: REP-01..REP-06, FEREP-01..FEREP-02.
- Group gate: all report tests pass and network inspection shows one mutation request.

Suggested commit: fix(moderation): make report content action atomic.

### G8 — Frontend compiler, lint, tests and pagination

Dependencies: G3 and G7.

#### T8.1 — Resolve strict TypeScript failures

- [ ] Remove truly unused imports/locals from all compiler-flagged files.
- [ ] Use intended auth/loading/pagination state where behavior requires it.
- [ ] Keep strict/noUnused flags enabled.
- Test ID: FEQ-01.

#### T8.2 — Make pagination/loading state real

- [ ] Add shared PaginationControls if page/total are retained.
- [ ] Cover empty, one-page and multi-page states.
- [ ] Ensure page changes trigger exactly one fetch.
- Test ID: FEQ-04.

#### T8.3 — Add ESLint

- [ ] Add compatible ESLint/TypeScript/React dependencies.
- [ ] Add checked-in config and ignores.
- [ ] Keep zero-warning gate.
- Test ID: FEQ-02.

#### T8.4 — Add Vitest suites

- [ ] Add test script and setup.
- [ ] Add auth, sanitizer, report and route tests from G3/G5/G7.
- [ ] Run without watch mode.
- Test ID: FEQ-03.

#### T8.5 — Lock dependencies and use npm ci

- [ ] Generate package-lock once after dependency edits settle.
- [ ] Verify clean npm ci.
- [ ] Switch frontend Dockerfile to npm ci.
- [ ] Review production audit; do not run blind force upgrades.
- Test IDs: FEQ-05, FEQ-06.
- Group gate: FEQ-01..06 pass from a clean install.

Suggested commit: build(frontend): restore strict build, lint, tests, and lockfile.

### G9 — Upload proxy and same-origin assets

Dependency: G8.

#### T9.1 — Add Vite upload proxy

- [ ] Route /uploads to backend:8000.
- [ ] Preserve relative returned URLs.
- Test ID: UP-03.

#### T9.2 — Add Nginx upload proxy

- [ ] Add location ^~ /uploads/.
- [ ] Place it so image extension regex cannot steal the request.
- Test IDs: UP-04, UP-05.

#### T9.3 — Run validation/retrieval smoke

- [ ] Re-run upload security tests.
- [ ] Upload one valid image.
- [ ] Fetch it through dev and production frontend ports and compare bytes.
- Test IDs: UP-01..UP-05.
- Group gate: upload security and both proxy paths pass.

Suggested commit: fix(upload): proxy uploaded assets in dev and production.

### G10 — Secure config and Docker bootstrap

Dependencies: G1, G2 and G9.

#### T10.1 — Add environment-aware settings

- [ ] Add environment mode and DB_ECHO.
- [ ] Use localhost CORS defaults in dev.
- [ ] Reject missing/default secret, DB URL and CORS origins in production.
- Test IDs: OPS-01, OPS-02, OPS-05.

#### T10.2 — Run Alembic before Uvicorn

- [ ] Add idempotent docker-entrypoint.sh.
- [ ] Copy/chmod/use it in dev and prod images.
- [ ] Keep supplied Uvicorn command as exec target.
- Test IDs: OPS-03, OPS-04, OPS-07.

#### T10.3 — Align Compose dev/prod

- [ ] Make .env optional or unnecessary for dev.
- [ ] Remove unused frontend env file.
- [ ] Parameterize DB healthcheck.
- [ ] Require production values at config time.
- [ ] Remove obsolete version keys.
- Test IDs: OPS-01..OPS-04.

#### T10.4 — Secure admin bootstrap

- [ ] Remove admin123 and inline bcrypt.
- [ ] Require explicit strong credentials.
- [ ] Use shared hash_password.
- [ ] Keep rerun idempotent.
- Test ID: OPS-06.

#### T10.5 — Update operator docs

- [ ] Document dev/prod env rules.
- [ ] Document automatic migrations and deliberate admin creation.
- [ ] Document health, upload smoke, backup and rollback.
- Test ID: OPS-07.
- Group gate: OPS-01..07 pass on fresh and restarted stacks.

Suggested commit: chore(deploy): secure config and migrate before startup.

### G11 — CI, full smoke and release gate

Dependencies: G5, G6, G7, G8, G9 and G10.

#### T11.1 — Add clean backend/frontend CI

- [ ] Backend: install, compileall, pytest.
- [ ] Frontend: npm ci, lint, build, Vitest.
- Test IDs: CI-01, CI-02.

#### T11.2 — Add PostgreSQL migration CI

- [ ] Start PostgreSQL service.
- [ ] Run Alembic upgrade.
- [ ] Inspect enum labels and run ORM smoke.
- Test ID: CI-03.

#### T11.3 — Add full product smoke flow

- [ ] Implement a PowerShell smoke script using HTTP APIs.
- [ ] Register/login, create pending post, approve, read publicly, interact, report/delete and retrieve upload.
- [ ] Assert every status code and final state.
- Test ID: E2E-01.

#### T11.4 — Run release/rollback checklist

- [ ] Back up database.
- [ ] Apply migration and deploy.
- [ ] Run health and E2E smoke.
- [ ] Verify logs contain no secret/raw unsafe HTML/SQL echo.
- [ ] Prove rollback path before approval.
- Test ID: REL-01.
- Group gate: CI-01..03, E2E-01 and REL-01 pass; all G0–G11 tasks are closed.

## 8. Test Strategy and Test Case Catalog

### 8.1 Test execution policy

- Every implementation task references one or more test IDs below.
- Run the smallest named tests while developing, the full group gate before merging a group, and the entire suite in G11.
- A test is not complete until it asserts input, action, status/error, response/state mutation and absence of unintended side effects.
- Existing tests remain regression constraints; do not weaken assertions to make a group green.
- SQLite proves fast application behavior; PostgreSQL is mandatory for enum and Alembic claims.
- Frontend mutation tests must assert request count and URL, not only rendered success text.

### 8.2 Core access matrix

Proposed default pending T0.3 approval:

| Actor | Approved + published read | Pending/rejected/unpublished read | Public interaction mutation | Non-public interaction mutation |
| --- | --- | --- | --- | --- |
| Anonymous | 200 for public GET | 404 | 401 on authenticated endpoints | 401 |
| Unrelated authenticated user | 200 | 404 | success | 404 |
| Owner | 200 | 200 | success | policy decision; recommended state-conflict response, no mutation |
| Moderator | 200 | 200 | success | policy decision; recommended state-conflict response, no mutation |
| Admin | 200 | 200 | success | policy decision; recommended state-conflict response, no mutation |

GET comments/reactions follows read visibility. Bookmark feed always excludes non-public posts. If T0.3 chooses different interaction behavior, update VIS-04..06 before implementation.

### 8.3 Test catalog

| ID | Layer | Scenario | Expected result |
| --- | --- | --- | --- |
| BASE-01 | baseline | git status/HEAD and source diff captured before implementation | Only known plan/user changes are present; source baseline is pinned. |
| BASE-02 | baseline | Run existing compile/test/build/lint/compose commands | Known failures are reproduced and recorded before fixes. |
| DB-LEGACY-01 | PostgreSQL | Inspect alembic_version and pg_enum for five application enum types | Database lineage and exact labels are known before migration authoring. |
| POLICY-01 | product gate | Approve pending-content interaction, token invalidation, sanitizer and CI policy | No implementation task depends on an unresolved behavioral choice. |
| DB-ENUM-01 | unit | Compile/bind every enum member through SQLAlchemy type | Bound database value equals lowercase member value. |
| DB-ENUM-02 | integration | Insert/read Post, Reaction and Report with every enum value | Roundtrip succeeds and API emits lowercase values. |
| DB-MIG-01 | PostgreSQL | Empty database → alembic upgrade head | Upgrade succeeds and enum labels exactly match model values. |
| DB-MIG-02 | PostgreSQL | Canonical lowercase schema → run corrective migration | No-op; data and labels unchanged. |
| DB-MIG-03 | PostgreSQL | Known uppercase legacy labels → run corrective migration | Labels are renamed safely; mixed uppercase/lowercase state fails diagnostically. |
| DB-ASYNC-01 | API | GET approved post detail twice | 200 twice; view_count increments 1 then 2; updated_at serializes. |
| DB-ASYNC-02 | API | Run post detail under AsyncSession with server-on-update field | No MissingGreenlet or implicit lazy IO. |
| AUTH-01 | API | Valid POST /api/v1/auth/register | 201 with access_token, refresh_token, bearer type. |
| AUTH-02 | API | Duplicate email or username registration | 400 with stable detail; no user inserted. |
| AUTH-03 | API | Active user login | 200; access token has type=access and refresh token type=refresh. |
| AUTH-04 | API | Inactive user login | 403; no tokens returned. |
| AUTH-05 | API | Access token with malformed UUID sub | 401, never 500/StatementError. |
| AUTH-06 | API | Send access token to refresh endpoint | 401 invalid refresh token. |
| AUTH-07 | API | Send valid refresh token | 200 with rotated access+refresh pair and correct token kinds. |
| AUTH-08 | API | Deactivate user then refresh | 403; no new tokens. |
| AUTH-09 | API | Optional auth receives invalid/malformed token | Public route behaves anonymous without 500. |
| FEAUTH-01 | frontend unit | Submit registration | POST /auth/register exactly once; never /users/. |
| FEAUTH-02 | frontend unit | Login/refresh/logout session transitions | Both tokens persist/rotate/clear atomically; old state migrates. |
| FEAUTH-03 | frontend unit | Protected request returns 401 then refresh succeeds | One refresh and one replay; caller receives replay response. |
| FEAUTH-04 | frontend unit | Three concurrent requests return 401 | Exactly one refresh promise; all requests replay once. |
| FEAUTH-05 | frontend unit | Refresh request fails | Session cleared once; redirect to /login preserves original path. |
| FEAUTH-06 | frontend unit | Login/register/refresh endpoint itself returns 401 | No recursive refresh or retry loop. |
| FEAUTH-07 | frontend component | Anonymous visits /admin | Redirect /login with from=/admin. |
| FEAUTH-08 | frontend component | user, moderator, admin visit admin routes | User denied; moderator/admin permitted; admin-only route remains admin-only. |
| FEAUTH-09 | frontend component | Anonymous visits edit route | Redirect login before loading/editing data. |
| VIS-01 | API matrix | GET post detail for 5 actors × 4 states | Public state is 200 for all; non-public is 200 only owner/mod/admin and 404 otherwise. |
| VIS-02 | API matrix | GET comments for 5 actors × 4 states | Same read visibility as detail; no hidden post leakage. |
| VIS-03 | API matrix | GET reaction counts for 5 actors × 4 states | Same read visibility as detail. |
| VIS-04 | API matrix | POST comment on public/non-public states | Anonymous 401; public authenticated 201; unrelated hidden 404; visible-but-noninteractive owner/staff follows approved policy decision. |
| VIS-05 | API matrix | Toggle reaction on public/non-public states | Public authenticated succeeds; hidden state cannot be mutated outside approved policy. |
| VIS-06 | API matrix | Bookmark then reject/unpublish post | Hidden post is absent from bookmark feed; toggle semantics remain deterministic. |
| VIS-07 | API | Author/staff list posts with status filters | Own/staff private statuses are available without leaking to public queries. |
| VIS-08 | API | Guess UUID/slug of hidden post as unrelated/anonymous | 404, not 403 or metadata-bearing response. |
| XSS-01 | backend unit/API | Content contains script element | Script removed before storage and response. |
| XSS-02 | backend unit/API | Image/link contains onerror/onclick | Event attributes removed. |
| XSS-03 | backend unit/API | Anchor uses javascript: URL | Unsafe href removed/rejected. |
| XSS-04 | backend unit/API | Image uses data: URL | Unsafe src removed/rejected; /uploads path remains allowed. |
| XSS-05 | backend unit/API | Valid TipTap headings/lists/links/images | Approved formatting and http/https/relative upload URLs remain. |
| XSS-06 | API | Create content becomes empty after sanitize | 422 and no row persisted. |
| XSS-07 | API | Update existing post with unsafe content | Sanitized safe row or 422; old safe value preserved on failure. |
| XSS-08 | integration | Existing unsafe DB row requested before/after backfill | Unsafe markup never reaches API response. |
| XSS-09 | frontend unit | Render malicious API HTML | DOM sanitizer removes executable markup. |
| XSS-10 | frontend component | Open pending post preview | Full content loads, loading/error states work, malicious HTML does not execute. |
| TAG-01 | API | Tag has one approved+published post | post_count=1. |
| TAG-02 | API | Same tag also has pending, rejected and unpublished posts | post_count remains 1. |
| TAG-03 | API | Multiple tags with filtered counts | Descending count then name ordering is stable. |
| REP-01 | API | Delete reported post content | Post rejected+unpublished and all matching open reports resolved in one commit. |
| REP-02 | API | Delete reported comment content | Comment tombstoned and reports resolved. |
| REP-03 | API | Delete reported user target | User inactive and reports resolved. |
| REP-04 | API | Two open reports for one target | One action resolves both with same resolver/time/note. |
| REP-05 | API | Target already absent | Documented idempotent response; report state remains consistent. |
| REP-06 | API | user/doctor vs moderator/admin content action | Unauthorized 403; moderator/admin succeeds. |
| FEREP-01 | frontend component/service | Click delete content | Exactly one DELETE /admin/reports/{id}/content; no target DELETE and no second resolve. |
| FEREP-02 | frontend component | Open/resolved/dismissed report states | Actions only for open; closed status label is accurate. |
| FEQ-01 | frontend build | npm run build | tsc and Vite build exit 0 with strict unused checks enabled. |
| FEQ-02 | frontend lint | npm run lint | Exit 0 with zero warnings. |
| FEQ-03 | frontend test | npm test -- --run | Vitest exits 0 without watch mode. |
| FEQ-04 | frontend component | 0/1/multi-page result sets | Controls and disabled states match total/page; fetch uses selected page. |
| FEQ-05 | dependency | Delete node_modules then npm ci | Install succeeds reproducibly and build/tests pass. |
| FEQ-06 | dependency | npm audit --omit=dev | Findings reviewed; no blind force upgrade. |
| UP-01 | API | Valid image <=5MB | 201 relative /uploads URL. |
| UP-02 | API | Spoofed MIME, corrupt image, empty or >5MB | 400; no file persisted. |
| UP-03 | dev proxy | GET returned upload URL through localhost:3000 | 200 and matching image bytes. |
| UP-04 | prod proxy | GET returned upload URL through production frontend | 200 and matching image bytes. |
| UP-05 | prod proxy | Uploaded .jpg/.png path also matches static regex | ^~ /uploads proxy wins; frontend root is not used. |
| OPS-01 | compose | docker compose config with no .env | Dev config succeeds with documented safe defaults. |
| OPS-02 | compose | Production config missing required secret/URL/origin | Config/start fails before app boot with clear message. |
| OPS-03 | container | Fresh PostgreSQL volume → compose up | Alembic reaches head before health endpoint succeeds. |
| OPS-04 | container | Restart migrated container | Migration is idempotent; server becomes healthy. |
| OPS-05 | config | Production settings | SQL echo is false and secrets are not logged. |
| OPS-06 | admin bootstrap | No admin credentials vs explicit strong credentials | Missing input fails; explicit input creates one hashed admin; rerun is idempotent. |
| OPS-07 | smoke | Follow documented dev setup from clean checkout | DB/backend/frontend start; /api/v1/health returns 200. |
| CI-01 | CI | Backend clean job | Install, compileall and pytest pass. |
| CI-02 | CI | Frontend clean job | npm ci, lint, build and Vitest pass. |
| CI-03 | CI | PostgreSQL service job | Alembic upgrade and enum ORM smoke pass. |
| E2E-01 | integration | Register→login→pending post→approve→public interaction→report/delete→upload retrieval | Every documented status/response and final moderation state passes. |
| REL-01 | release | Execute backup/migrate/health/smoke/rollback checklist | Evidence attached; rollback path is executable before production approval. |

### 8.4 Group gates

- G0: BASE-01/02, DB-LEGACY-01 and POLICY-01 evidence complete.
- G1: DB-ENUM-01/02, DB-MIG-01..03 as applicable, DB-ASYNC-01/02.
- G2: AUTH-01..09 plus existing admin RBAC tests.
- G3: FEAUTH-01..09.
- G4: VIS-01..08 plus existing posts/comments/reactions/bookmarks suites.
- G5: XSS-01..10 and representative manual TipTap rendering.
- G6: TAG-01..03 plus category regressions.
- G7: REP-01..06 and FEREP-01/02.
- G8: FEQ-01..06 from clean npm ci.
- G9: UP-01..05.
- G10: OPS-01..07 on fresh and restarted stacks.
- G11: CI-01..03, E2E-01 and REL-01.

### 8.5 Final verification commands

- python -m compileall -q backend/app backend/tests
- python -m pytest -q
- npm ci
- npm run lint
- npm run build
- npm test -- --run
- docker compose config
- docker compose up --build
- HTTP smoke against /api/v1/health plus E2E-01 flow
- npm audit --omit=dev after lockfile exists

The baseline failures remain evidence, not expected final output: 42 failed/5 passed backend, 28 TypeScript build errors, missing ESLint binary, missing frontend test script and Compose requiring absent .env.

## 9. Risk and Impact Analysis

- Database/migration risk [high]: enum column changes touch every insert/read of Post, Reaction and Report. Direct source-derived dependents are the routers, schemas, admin pages and tests listed in Sections 2, 4, 6 and 8. Verify pg_enum, representative writes and rollback before production.
- Authentication risk [high]: get_current_user is a shared dependency. UUID parsing changes all authenticated endpoints; token-kind claims affect login, refresh, admin RBAC, uploads and every authenticated service call. Treat old sessions and refresh failure as an explicit rollout event.
- Visibility/privacy risk [high]: post status/publication changes affect feed, detail, comments, reactions, bookmarks, tag/category counts and report target access. Test 5 actor classes × 4 post states; retain 404 for hidden content.
- XSS/data-integrity risk [high]: post HTML is untrusted input and has two render sinks. Sanitizing only on the client is insufficient; sanitize writes, responses and legacy data/backfill, then test URLs/attributes/events.
- Admin moderation risk [high]: replacing two frontend requests with one backend transaction changes error handling but improves consistency. Test missing targets, already-resolved reports, multiple reports and user-target reports.
- Frontend interceptor risk [medium/high]: the API client is shared by auth/admin/content services. Exclude auth endpoints, guard replay, serialize concurrent refreshes and preserve original errors.
- Deployment risk [high]: automatic migrations can block startup or reveal schema conflicts. Run against disposable PostgreSQL and a copy of the production schema; keep entrypoint idempotent and avoid data destructive operations.
- Performance risk [medium]: explicit post requery adds one read to detail requests; HTML sanitization adds CPU on writes/reads; admin report enrichment already performs per-report lookups (backend/app/api/v1/admin.py:405-459). Measure later, but correctness takes priority.
- Compatibility risk [medium]: sanitizer may remove previously accepted markup; admin preview may switch from list data to detail fetch; old compatibility endpoint aliases can remain server-side while frontend migrates.
- Observability requirement [medium]: log migration failure, refresh failure and sanitizer rejection without logging JWTs, passwords or raw unsafe HTML; turn SQL echo off by default.

## 10. Files Expected to Change

| File | Symbols/area | Reason |
| --- | --- | --- |
| backend/app/models/user.py, post.py, reaction.py, report.py | Enum columns | Align DB values with migrations |
| backend/alembic/versions/0003_enum_value_alignment.py | New corrective migration | Normalize only proven legacy enum deployments |
| backend/app/core/security.py, config.py, database.py | JWT/config/engine | Token kinds, safe defaults, no production SQL echo |
| backend/app/api/deps.py, backend/app/api/v1/auth.py | Auth dependencies/endpoints | UUID parsing, active checks, refresh semantics |
| backend/app/services/post_access.py | New shared policy | One visibility matrix |
| backend/app/services/content_sanitizer.py | New sanitizer | Server-side HTML/URL policy |
| backend/app/api/v1/posts.py | Post lifecycle | Sanitize, visibility, refresh after commit |
| backend/app/api/v1/comments.py, reactions.py, bookmarks.py | Interaction routes | Enforce post visibility |
| backend/app/api/v1/tags.py | Aggregation | Count filtered Post rows |
| backend/app/api/v1/admin.py | Moderation/report APIs | Preserve atomic action and safe preview contract |
| backend/app/api/v1/upload.py | Upload response/validation | Keep relative asset contract and URL policy |
| backend/app/schemas/user.py, post.py, report.py | API contracts | Typed token/moderation/report shapes |
| backend/requirements.txt | Runtime/test dependencies | Sanitizer and reproducible test environment |
| backend/Dockerfile, backend/docker-entrypoint.sh, backend/app/create_admin.py | Container/runtime | Migrations first, secure admin creation |
| backend/tests/conftest.py, existing backend test modules | Regression fixtures/tests | Exercise corrected boundaries |
| backend/tests/test_auth.py, backend/tests/test_migrations.py | New tests | Auth and PostgreSQL migration gates |
| frontend/package.json, frontend/package-lock.json, frontend/.eslintrc.cjs | Tooling | ESLint, Vitest scripts/dependency lock |
| frontend/src/services/authService.ts, frontend/src/lib/api.ts, frontend/src/stores/authStore.ts, frontend/src/types/index.ts | Auth client/session | Register/refresh/retry contract |
| frontend/src/pages/LoginPage.tsx, PostDetailPage.tsx, EditPostPage.tsx | Auth/render UX | Correct route, sanitized HTML, login guard |
| frontend/src/lib/sanitizeHtml.ts | New client utility | Render defense-in-depth |
| frontend/src/services/adminService.ts | Admin client | Canonical URLs/no duplicate mutations |
| frontend/src/pages/admin/AdminReportsPage.tsx, AdminModerationPage.tsx, AdminDashboardPage.tsx, AdminUsersPage.tsx, AdminCategoriesPage.tsx | Admin UI | Atomic report action, preview/loading/pagination, compiler cleanup |
| frontend/src/components/admin/AdminRouteGuard.tsx, AdminOnlyGuard.tsx, ReportActionModal.tsx, EditUserModal.tsx | Admin guards/modals | Redirect, closed statuses, compiler cleanup |
| frontend/src/components/comments/CommentItem.tsx, frontend/src/components/common/ReportModal.tsx | Community UI | Compiler cleanup/report state compatibility |
| Compiler-flagged frontend files: CreatePostBox.tsx, Header.tsx, ReactionButtons.tsx, HomePage.tsx, BookmarksPage.tsx, TagPage.tsx, CreatePostPage.tsx | Imports/dead state | Restore strict build without disabling checks |
| frontend/vite.config.ts, frontend/nginx.conf, frontend/Dockerfile | Dev/prod delivery | /uploads proxy and npm ci |
| docker-compose.yml, docker-compose.prod.yml, .env.example, README.md, PROJECT.md | Operations/docs | Env policy, migration/admin startup and verified contracts |
| .github/workflows/ci.yml | New CI gate | Backend/frontend/PostgreSQL verification |

## 11. Reusable Implementation Context

The following machine-readable pack is the handoff contract for an implementation agent. It includes the exact schema-2 provenance snapshot; do not manually regenerate its digest or manifest.

~~~json
{
  "implementation_context": {
    "task_summary": "Decomposed implementation backlog for Healthcare Forum hardening, organized as G0–G11 with atomic tasks, dependencies, test IDs and per-group gates.",
    "acceptance_criteria": [
      "Backend test suite pass sau khi cài backend/requirements.txt; không còn lỗi UUID string trên SQLite hoặc MissingGreenlet khi đọc post detail.",
      "Enum model serialize đúng các label lowercase đã được Alembic tạo; fresh PostgreSQL migration và legacy database path được kiểm chứng.",
      "Người dùng chỉ nhìn thấy/tương tác với post approved + published, trừ owner/staff theo ma trận quyền; bookmark feed không giữ nội dung đã gỡ.",
      "HTML bài viết được sanitize ở backend trước khi lưu và có defense-in-depth ở frontend trước khi render.",
      "Register gọi /auth/register; refresh token được lưu, phân biệt access/refresh, retry 401 tối đa một lần và không loop.",
      "Admin report deletion gọi một endpoint atomic cho post/comment/user và cập nhật UI đúng trạng thái.",
      "Frontend npm run build, npm run lint và npm test -- --run pass; lockfile được commit và Docker dùng npm ci.",
      "docker compose config không yêu cầu file .env trong dev; production fail-fast nếu thiếu secret/config; startup tự chạy Alembic.",
      "Upload URL /uploads/... hoạt động ở cả Vite dev proxy và Nginx production.",
      "Tài liệu README/PROJECT được cập nhật; CI hoặc smoke gate kiểm chứng các boundary chính."
    ],
    "evidence_provenance": {
      "schema_version": 2,
      "head_commit": "c9d8edb53761a0da4d879cd7f56472f66abbaa0e",
      "generated_plan_path": "docs/plans/2026-08-30-gitnexus-plan-healthcare-forum-hardening.md",
      "global_dirty_digest": {
        "algorithm": "sha256",
        "canonicalization": "gitnexus-evidence-provenance-v2 NUL-framed UTF-8 records",
        "value": "1151c4ef469899c09c85d3d1b934975efd1778e08e8c578b69aed873d600fa53"
      },
      "cited_path_manifest": [
        {
          "path": ".env.example",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:33ee2ba7afae815876b034910e1ceb2f4c798d277650622bd9791916b748bd2c",
          "index_digest": "sha256:33ee2ba7afae815876b034910e1ceb2f4c798d277650622bd9791916b748bd2c",
          "worktree_digest": "sha256:84700515009dd0732473f04f820a8f0bc13c101cfbb9bd2cca3d05422aaa761b",
          "untracked_digest": "absent"
        },
        {
          "path": "PROJECT.md",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:3ada6430c1ba1d1dd4717a9bbd3a211e3e8b43faa3ae16087dfce8008e2107d6",
          "index_digest": "sha256:3ada6430c1ba1d1dd4717a9bbd3a211e3e8b43faa3ae16087dfce8008e2107d6",
          "worktree_digest": "sha256:0104a430ce04357db2023b422c0b056a98617d40237a6a55d1e00dc4e018bbc4",
          "untracked_digest": "absent"
        },
        {
          "path": "README.md",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:a9f2821e3025ed3d3d7bed56ba0ba54cb4af99b7b929b8c6b1e467acc4f1eb1f",
          "index_digest": "sha256:a9f2821e3025ed3d3d7bed56ba0ba54cb4af99b7b929b8c6b1e467acc4f1eb1f",
          "worktree_digest": "sha256:f4a7a71640f9f2055c87c3ba282648b9271c691f2dc9aff1aadd81557ec95875",
          "untracked_digest": "absent"
        },
        {
          "path": "backend/Dockerfile",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:aff249184f37845d996cd14fd0db22438c5ad4518b0191b4ab16bec665b7a6bc",
          "index_digest": "sha256:aff249184f37845d996cd14fd0db22438c5ad4518b0191b4ab16bec665b7a6bc",
          "worktree_digest": "sha256:604375a8cf5558690d309cb032217673dc4f6783c189d76198197c97b42561f2",
          "untracked_digest": "absent"
        },
        {
          "path": "backend/alembic/versions/0001_phase2_content_community.py",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:7015aa8962cdfeafda7450d66c0d6404e9159bd13cfdcb2c1763df4415329a6f",
          "index_digest": "sha256:7015aa8962cdfeafda7450d66c0d6404e9159bd13cfdcb2c1763df4415329a6f",
          "worktree_digest": "sha256:ceccb729470305811875a25d98b45374ac4f5b46f5ed5498ef9a527f60679714",
          "untracked_digest": "absent"
        },
        {
          "path": "backend/alembic/versions/0002_phase3_admin_moderation.py",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:85266830eab78779bb58dffb7d31d931fe3df1c6eaa7af35935b30dbc002ead2",
          "index_digest": "sha256:85266830eab78779bb58dffb7d31d931fe3df1c6eaa7af35935b30dbc002ead2",
          "worktree_digest": "sha256:1f00ec51282323a91fcab2da566db05970e11bb6592f0f74050e1220e888a486",
          "untracked_digest": "absent"
        },
        {
          "path": "backend/app/api/deps.py",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:31dab300d83162934003349ab70e4665405a496900606b1519db38f17b1e8b61",
          "index_digest": "sha256:31dab300d83162934003349ab70e4665405a496900606b1519db38f17b1e8b61",
          "worktree_digest": "sha256:88d3799fe10655d87457571d050e7267aecf78e43fed41d60f0d4f0cb1621a37",
          "untracked_digest": "absent"
        },
        {
          "path": "backend/app/api/v1/admin.py",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:047ece9e82efa0a4d1d7b9b9ed9e16e21696868d0f3728321a7bac57a741952b",
          "index_digest": "sha256:047ece9e82efa0a4d1d7b9b9ed9e16e21696868d0f3728321a7bac57a741952b",
          "worktree_digest": "sha256:e202f10ad01b2d07085084ff374dd1ba1d4f5b7e4b9399a01bec0b4a6b0639a2",
          "untracked_digest": "absent"
        },
        {
          "path": "backend/app/api/v1/auth.py",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:4166fbda22f83378e618b3ec42c3992bfabaed8aa142c1c41ee4d47acad7f6f8",
          "index_digest": "sha256:4166fbda22f83378e618b3ec42c3992bfabaed8aa142c1c41ee4d47acad7f6f8",
          "worktree_digest": "sha256:93b88c5342bc68f5f85f05fbe222a73a1fdc3a8d8bef98b8a552b5093f09424c",
          "untracked_digest": "absent"
        },
        {
          "path": "backend/app/api/v1/bookmarks.py",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:860418953f615d60ee9822e8598e18f82f08055ecb1afdb64385999c36d3a6fa",
          "index_digest": "sha256:860418953f615d60ee9822e8598e18f82f08055ecb1afdb64385999c36d3a6fa",
          "worktree_digest": "sha256:7893de4250e7384883f5034d2d9423587e3abf4130c226d37669d69b76accaf8",
          "untracked_digest": "absent"
        },
        {
          "path": "backend/app/api/v1/comments.py",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:e315102714a669dae907c1222873deb7eee7a4695650d8be5b7ccdd8ebe3fb52",
          "index_digest": "sha256:e315102714a669dae907c1222873deb7eee7a4695650d8be5b7ccdd8ebe3fb52",
          "worktree_digest": "sha256:cd697e9a83074656a7469e393cb5ce72d9d531bb253c022b262fff865df421e7",
          "untracked_digest": "absent"
        },
        {
          "path": "backend/app/api/v1/posts.py",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:29d33fd75af8284e0cec6bce291464f5ad30b0e40a5a9986bcdf16a6941f4fb2",
          "index_digest": "sha256:29d33fd75af8284e0cec6bce291464f5ad30b0e40a5a9986bcdf16a6941f4fb2",
          "worktree_digest": "sha256:5700b3e3557c8181282444d161cf39060c58891ac168031073cea2f3ff67d496",
          "untracked_digest": "absent"
        },
        {
          "path": "backend/app/api/v1/reactions.py",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:b777ae738419011ccd7671938fb9e7efe0a2eb032458659b040607052c596e8d",
          "index_digest": "sha256:b777ae738419011ccd7671938fb9e7efe0a2eb032458659b040607052c596e8d",
          "worktree_digest": "sha256:55c361f6906ba8df416c94b90cb2694723f21482b7ad147a3cf55aec8b2a0bb0",
          "untracked_digest": "absent"
        },
        {
          "path": "backend/app/api/v1/tags.py",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:3514fc10b9ce5c25d6859e2727c7ad42e833a2fb3339bde545881ff61b1450b2",
          "index_digest": "sha256:3514fc10b9ce5c25d6859e2727c7ad42e833a2fb3339bde545881ff61b1450b2",
          "worktree_digest": "sha256:30708f87f0141e92716751c8599ff7eb005bdb117efbfd7e2294b30c92b14b92",
          "untracked_digest": "absent"
        },
        {
          "path": "backend/app/api/v1/upload.py",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:ede6815e8b23c229dd289899f4853de4b73152f483994ca4244d2191f54ac593",
          "index_digest": "sha256:ede6815e8b23c229dd289899f4853de4b73152f483994ca4244d2191f54ac593",
          "worktree_digest": "sha256:f121f23431c8843bf072430dcaa6384b49498da49997b9d04ac4a4c69819db82",
          "untracked_digest": "absent"
        },
        {
          "path": "backend/app/core/config.py",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:632b3d187a7fdc5d1f3db8a4f609e90ad227ac38df5ef38ba18edb3dcd9cd60a",
          "index_digest": "sha256:632b3d187a7fdc5d1f3db8a4f609e90ad227ac38df5ef38ba18edb3dcd9cd60a",
          "worktree_digest": "sha256:90e205ec0dd7628752a873e55448d8dc169df34d47dac03596fbb3a4ffcad169",
          "untracked_digest": "absent"
        },
        {
          "path": "backend/app/core/database.py",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:d7d8096a769cf44e69ecb62f4ce5bf595908aef3b61a2237dfcaccd527da52ef",
          "index_digest": "sha256:d7d8096a769cf44e69ecb62f4ce5bf595908aef3b61a2237dfcaccd527da52ef",
          "worktree_digest": "sha256:2c4aaa38f59c06a071f55a85c600352901a9e2984147d5bd5ac03af6a28a5a85",
          "untracked_digest": "absent"
        },
        {
          "path": "backend/app/core/security.py",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:ecc81d6a181a1d41ce99fe6989748cd3dc59e9e265ed6f778d3427f9982ebc8e",
          "index_digest": "sha256:ecc81d6a181a1d41ce99fe6989748cd3dc59e9e265ed6f778d3427f9982ebc8e",
          "worktree_digest": "sha256:db9bfb909ac0f964d922d0280eb52debbde793619e13e5f1db4d3498bce1beb0",
          "untracked_digest": "absent"
        },
        {
          "path": "backend/app/create_admin.py",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:b9dbeec29771420c9489207fd631fb5c40190c84f9aae37c1c609bbe1b28cf6e",
          "index_digest": "sha256:b9dbeec29771420c9489207fd631fb5c40190c84f9aae37c1c609bbe1b28cf6e",
          "worktree_digest": "sha256:984cfebae73e99204a367e59e5fc386ea2425eac54ff4275ddaf013600a37ad5",
          "untracked_digest": "absent"
        },
        {
          "path": "backend/app/main.py",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:d400312f8698ef9fc87f014d0533d978ace66e616736d91973077cc946f18675",
          "index_digest": "sha256:d400312f8698ef9fc87f014d0533d978ace66e616736d91973077cc946f18675",
          "worktree_digest": "sha256:08e2d0a6f617a4a1659d0755be7fd4df9f4d817733aeef589089099caba42f81",
          "untracked_digest": "absent"
        },
        {
          "path": "backend/app/models/post.py",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:6e352bbc7cf087abec00d65f4deef6b6ff44e104f4c0c55369068fd00ac0f443",
          "index_digest": "sha256:6e352bbc7cf087abec00d65f4deef6b6ff44e104f4c0c55369068fd00ac0f443",
          "worktree_digest": "sha256:61eda1f4d5a941a5a710a965c35d99b19127bf2145304fd8eee3ec9c48db046b",
          "untracked_digest": "absent"
        },
        {
          "path": "backend/app/models/reaction.py",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:2522815fe79f8229ed799ed32b77b4407c4270e50c802d7207040859ce537499",
          "index_digest": "sha256:2522815fe79f8229ed799ed32b77b4407c4270e50c802d7207040859ce537499",
          "worktree_digest": "sha256:ced074579d6f1f6f6d9f01ff9d7f4337d099f2e37789686c88304fda7e867cc9",
          "untracked_digest": "absent"
        },
        {
          "path": "backend/app/models/report.py",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:e3abfbe01cb4cb9072c96cc04706573bab2f6ef63af8756ccf8977bf675e9295",
          "index_digest": "sha256:e3abfbe01cb4cb9072c96cc04706573bab2f6ef63af8756ccf8977bf675e9295",
          "worktree_digest": "sha256:0d121ac9db5084107740139cb19af659d920de92cc6b7229babc92b291883e99",
          "untracked_digest": "absent"
        },
        {
          "path": "backend/app/models/user.py",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:40e716687ab3fef20fdd33a9d1f5aa27dd6d7f87ac92d8f77682e1b6022a7bce",
          "index_digest": "sha256:40e716687ab3fef20fdd33a9d1f5aa27dd6d7f87ac92d8f77682e1b6022a7bce",
          "worktree_digest": "sha256:e3c0cbffd5ccd52c2ce1f104811ba1c8b3d5dccceb70d5e12e1ea25b41dbac9d",
          "untracked_digest": "absent"
        },
        {
          "path": "backend/app/schemas/post.py",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:83950b4fb35fd907b925f93cbf5fe97237b3d62e52f4de33a1860af94eb2e587",
          "index_digest": "sha256:83950b4fb35fd907b925f93cbf5fe97237b3d62e52f4de33a1860af94eb2e587",
          "worktree_digest": "sha256:1ab4fa08ab5e2f779d47c0e825981ab70e4ebf9bcdabc464148ea17caafc1a0c",
          "untracked_digest": "absent"
        },
        {
          "path": "backend/app/schemas/report.py",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:2a1641d96f6bccf3ba0ba88878ecbba241bd38c7a6cb207e5cf9b152f4a63817",
          "index_digest": "sha256:2a1641d96f6bccf3ba0ba88878ecbba241bd38c7a6cb207e5cf9b152f4a63817",
          "worktree_digest": "sha256:1bebebbc9f650cde1eb3528ec7af067dddff46358037fc082315871bfe053a8c",
          "untracked_digest": "absent"
        },
        {
          "path": "backend/app/schemas/user.py",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:96d8c8f3a450c2858b31f77335a0dbfbed1ba6418ca9bd0c5a50ee827df57409",
          "index_digest": "sha256:96d8c8f3a450c2858b31f77335a0dbfbed1ba6418ca9bd0c5a50ee827df57409",
          "worktree_digest": "sha256:1cc0e96b063608581b49b5796a0d7b1bcb8f13cd6c0320323a17a6ab0f6c093f",
          "untracked_digest": "absent"
        },
        {
          "path": "backend/requirements.txt",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:1a9cea5706c06edede79242cfad5f4afa9d81bea879361214656bf31b4196eff",
          "index_digest": "sha256:1a9cea5706c06edede79242cfad5f4afa9d81bea879361214656bf31b4196eff",
          "worktree_digest": "sha256:0e1bec94f4a0a9fcb1c60f821c6fe8d343a94055c82fdfe052327e45228481c2",
          "untracked_digest": "absent"
        },
        {
          "path": "backend/tests/conftest.py",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:d22565ecf6c74e636ea2efa4ed50008a0e956e3294aab7b3643b03846219be68",
          "index_digest": "sha256:d22565ecf6c74e636ea2efa4ed50008a0e956e3294aab7b3643b03846219be68",
          "worktree_digest": "sha256:5ca9895ca016d41b0244842f8341849d57753ffa290d76a160fa0e1dc5c541ab",
          "untracked_digest": "absent"
        },
        {
          "path": "backend/tests/test_admin_categories.py",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:ca94d7406ff2eee5141176c6fd41715bf1161edcf55ad031b9a567b73232b170",
          "index_digest": "sha256:ca94d7406ff2eee5141176c6fd41715bf1161edcf55ad031b9a567b73232b170",
          "worktree_digest": "sha256:14ee67386db32b980c631a78b3e5e75f6cf267fe4f4b1d4f677bf4292f23b697",
          "untracked_digest": "absent"
        },
        {
          "path": "backend/tests/test_admin_stats.py",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:7458ed00b29b865f7852899cec45a1201c93b8bdb33308171d5d86017b1c6a9f",
          "index_digest": "sha256:7458ed00b29b865f7852899cec45a1201c93b8bdb33308171d5d86017b1c6a9f",
          "worktree_digest": "sha256:2cc51fc7609d1eb9fc07ae9ba5e48b125641fc8841206c5e96b9bada78b91ca9",
          "untracked_digest": "absent"
        },
        {
          "path": "backend/tests/test_admin_users.py",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:1aa35a6e1bcb3f0d0d5f33ff6f609d73dade13752fb5a6aff289a83fff5191e6",
          "index_digest": "sha256:1aa35a6e1bcb3f0d0d5f33ff6f609d73dade13752fb5a6aff289a83fff5191e6",
          "worktree_digest": "sha256:bf27f671e351f0a1659c364fc9621695f0a8672aee46ec6aa650c2f1ad8f8eb6",
          "untracked_digest": "absent"
        },
        {
          "path": "backend/tests/test_adversarial_backend.py",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:dac1a4c13bc03dcdc9933e000e08b7ef6dbc61adf29f76ced98acd0da69d11af",
          "index_digest": "sha256:dac1a4c13bc03dcdc9933e000e08b7ef6dbc61adf29f76ced98acd0da69d11af",
          "worktree_digest": "sha256:532563240bdfefab9a0ae681a0ff8877dc6e61d63783931529c4eae6c7e9462a",
          "untracked_digest": "absent"
        },
        {
          "path": "backend/tests/test_bookmarks.py",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:72c390ccb1030dde1318d28898e47463ec75e8e7c31fc71d7dd3227e929439e8",
          "index_digest": "sha256:72c390ccb1030dde1318d28898e47463ec75e8e7c31fc71d7dd3227e929439e8",
          "worktree_digest": "sha256:5b9316d93460a22a32d6d469edf2d41943fab0f4a88f3d3a75643daa11c41306",
          "untracked_digest": "absent"
        },
        {
          "path": "backend/tests/test_comments.py",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:d27c96fb764c422bdbf3e26914a67b85c03860ef3bebe9dd29d9e3b9d6218016",
          "index_digest": "sha256:d27c96fb764c422bdbf3e26914a67b85c03860ef3bebe9dd29d9e3b9d6218016",
          "worktree_digest": "sha256:3750d277f2186f2a8eb7fe91153773fa2bcd83a56a749a6c8b4ac1733bc5276d",
          "untracked_digest": "absent"
        },
        {
          "path": "backend/tests/test_moderation.py",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:568e0eb23a1fcc6806ae7dcb6c86d940d426a0b2f580b49c6bcf31fb52ca13ad",
          "index_digest": "sha256:568e0eb23a1fcc6806ae7dcb6c86d940d426a0b2f580b49c6bcf31fb52ca13ad",
          "worktree_digest": "sha256:1fa459e2df788475dd856463872aadf46acea5e152524e6ec89a9eb033becb36",
          "untracked_digest": "absent"
        },
        {
          "path": "backend/tests/test_posts.py",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:755e80f90658a026b6878c2087d9bac1041301a1e903da577a4ebfcf258df4a4",
          "index_digest": "sha256:755e80f90658a026b6878c2087d9bac1041301a1e903da577a4ebfcf258df4a4",
          "worktree_digest": "sha256:a516455b70b484f659cd04e1d2befa1c4aa193c62aa6207509c3e8caa4e90953",
          "untracked_digest": "absent"
        },
        {
          "path": "backend/tests/test_reactions.py",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:1fb07889403085ce57eb4e1dfd4023b4893fd084bdefb5b9151d8917213187a9",
          "index_digest": "sha256:1fb07889403085ce57eb4e1dfd4023b4893fd084bdefb5b9151d8917213187a9",
          "worktree_digest": "sha256:b46f683f4de5151c6af78f221cb9686f7cefeadac97d45a5c7b39cb214b8a260",
          "untracked_digest": "absent"
        },
        {
          "path": "backend/tests/test_reports.py",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:ecdd918b79259409f9de810d058057da9be574361be5acda9a6a9120b7a5d972",
          "index_digest": "sha256:ecdd918b79259409f9de810d058057da9be574361be5acda9a6a9120b7a5d972",
          "worktree_digest": "sha256:38ef182c1c5fed36b7e3f7afa74970130f992e86094f393cba3d7158c7b9e0e9",
          "untracked_digest": "absent"
        },
        {
          "path": "backend/tests/test_tags_categories.py",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:9e60c0b1f8c55332cfdd42f9c37d5c81cf34829e550b751a1ec7ef485cf38f00",
          "index_digest": "sha256:9e60c0b1f8c55332cfdd42f9c37d5c81cf34829e550b751a1ec7ef485cf38f00",
          "worktree_digest": "sha256:9d635005dcfb7871e61e5f3230b2a7cd510b91025899568e45e9c24024bd0e75",
          "untracked_digest": "absent"
        },
        {
          "path": "backend/tests/test_upload.py",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:8bdf762cfc7c959ca4c2418781702841926d1fbb0afbf5352e48bdd1a4057b16",
          "index_digest": "sha256:8bdf762cfc7c959ca4c2418781702841926d1fbb0afbf5352e48bdd1a4057b16",
          "worktree_digest": "sha256:6e3a3686ae421bbfc23e35bfad7f47de4082c6a5d36f1acbf940140ad3f3a2a4",
          "untracked_digest": "absent"
        },
        {
          "path": "docker-compose.prod.yml",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:38875be035c136d7e98b57f337752e83c53667b21a582c638ba922f073ca4383",
          "index_digest": "sha256:38875be035c136d7e98b57f337752e83c53667b21a582c638ba922f073ca4383",
          "worktree_digest": "sha256:20a1e301d8c1a32af32940af3d0cc85975d629a5d8657ec894180dc760e02a1d",
          "untracked_digest": "absent"
        },
        {
          "path": "docker-compose.yml",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:8c27e5437579eeadde89da874cf9995f6c75ecd0dbbacf602baf66d568baddcd",
          "index_digest": "sha256:8c27e5437579eeadde89da874cf9995f6c75ecd0dbbacf602baf66d568baddcd",
          "worktree_digest": "sha256:e165371615dbb6a7c26ad7f4ef70c8c6aa21539f51b60cc8a74ba1806f5e0ff4",
          "untracked_digest": "absent"
        },
        {
          "path": "frontend/Dockerfile",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:4ce108285e191d2f6e1525189fc673747940a6445d79595504f063dc2890da9d",
          "index_digest": "sha256:4ce108285e191d2f6e1525189fc673747940a6445d79595504f063dc2890da9d",
          "worktree_digest": "sha256:b4b221c54473a9c9c8b57cc0c7fb354f2b889650f4902f783ad17ffeda6ea982",
          "untracked_digest": "absent"
        },
        {
          "path": "frontend/nginx.conf",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:48dc8abe70436418e6984249066ac0800c45b7a517c8913b964b75c87ae70dc0",
          "index_digest": "sha256:48dc8abe70436418e6984249066ac0800c45b7a517c8913b964b75c87ae70dc0",
          "worktree_digest": "sha256:3bc2f2284be6ef379f91167a699120bba7f4bf271e1c99a05ecd297864d546d5",
          "untracked_digest": "absent"
        },
        {
          "path": "frontend/package.json",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:3125c377d2668f8265e328c83bf8f6b5fa80ce7137f8af920be56337b281b25d",
          "index_digest": "sha256:3125c377d2668f8265e328c83bf8f6b5fa80ce7137f8af920be56337b281b25d",
          "worktree_digest": "sha256:f163d2b936b29721b4cf793d0ea9a8aa31e3c380e4e5fd3d48a19fc7015c3eea",
          "untracked_digest": "absent"
        },
        {
          "path": "frontend/src/components/Feed/CreatePostBox.tsx",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:1751ccbdf0bc9679e2e277a991fbd2001f726a672b74f8482a2355a3f4ffa8b7",
          "index_digest": "sha256:1751ccbdf0bc9679e2e277a991fbd2001f726a672b74f8482a2355a3f4ffa8b7",
          "worktree_digest": "sha256:b24b0e682a629e941a473f93e4364b1e87faa07c1bc8e297489654120ad15c62",
          "untracked_digest": "absent"
        },
        {
          "path": "frontend/src/components/Header/Header.tsx",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:31a0ce454b9b400652dba683916e473f2828f1e5066efad710a80ac029511ce4",
          "index_digest": "sha256:31a0ce454b9b400652dba683916e473f2828f1e5066efad710a80ac029511ce4",
          "worktree_digest": "sha256:95ef452a3ab1b3379971cb37a9fac61537328bdb9abad9ec142b6d780162a45f",
          "untracked_digest": "absent"
        },
        {
          "path": "frontend/src/components/admin/AdminOnlyGuard.tsx",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:e295c941f9453a638bfc2aa9206971145f549308fb2089891d35e85db6a5bfe9",
          "index_digest": "sha256:e295c941f9453a638bfc2aa9206971145f549308fb2089891d35e85db6a5bfe9",
          "worktree_digest": "sha256:e30425d8ec446745dfb0150bcb50ea7f84f12535fdb4fed7b1d60e4b5a584734",
          "untracked_digest": "absent"
        },
        {
          "path": "frontend/src/components/admin/AdminRouteGuard.tsx",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:fb83f40c33c7816957b917f821549ddf87eccf9c79ed3a3254e52e1cf4d452dd",
          "index_digest": "sha256:fb83f40c33c7816957b917f821549ddf87eccf9c79ed3a3254e52e1cf4d452dd",
          "worktree_digest": "sha256:c7633dfc911e698ae0dc16eaa35314a876d725e57d9c7c967e7900497f74c047",
          "untracked_digest": "absent"
        },
        {
          "path": "frontend/src/components/admin/EditUserModal.tsx",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:a0d66e8f1f9a3e4a23a83572bfc9572cf4c09c60b755e2d464432d3e7785463a",
          "index_digest": "sha256:a0d66e8f1f9a3e4a23a83572bfc9572cf4c09c60b755e2d464432d3e7785463a",
          "worktree_digest": "sha256:1669ed68375a66ad7e1982dfbdc5658736f59d3045b17c30b41f6ab62a23ac57",
          "untracked_digest": "absent"
        },
        {
          "path": "frontend/src/components/admin/ReportActionModal.tsx",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:088c4e58cad9ed30f8b46b06a1af915543c44d98a4f49c9d53065c6f94c54b6f",
          "index_digest": "sha256:088c4e58cad9ed30f8b46b06a1af915543c44d98a4f49c9d53065c6f94c54b6f",
          "worktree_digest": "sha256:30d19cfa051e641f96327753fc2287944c07f80423cbe8b9775e39c24106006c",
          "untracked_digest": "absent"
        },
        {
          "path": "frontend/src/components/comments/CommentItem.tsx",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:b7773102966434048148a8c090e466648ab36b6312af4cb32cfb04ba53eff2c9",
          "index_digest": "sha256:b7773102966434048148a8c090e466648ab36b6312af4cb32cfb04ba53eff2c9",
          "worktree_digest": "sha256:c6ffc03cbf39e99fd55cbde256c327bc6a6f6fee946944e7cd039b4081ae6d68",
          "untracked_digest": "absent"
        },
        {
          "path": "frontend/src/components/common/ReportModal.tsx",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:88156a8a696d4a94a1805a02f9627a21dc9ac9377d3e11430a8d01238d178e83",
          "index_digest": "sha256:88156a8a696d4a94a1805a02f9627a21dc9ac9377d3e11430a8d01238d178e83",
          "worktree_digest": "sha256:f66fbc2910d4777d168ae536df208a4e11311fafc1c72d6ac422e6d24e09fafc",
          "untracked_digest": "absent"
        },
        {
          "path": "frontend/src/components/posts/ReactionButtons.tsx",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:c15f8489756d96b36ee8b8c4ab33253f04f9e870ac8c4fd7998a54b09e9b9673",
          "index_digest": "sha256:c15f8489756d96b36ee8b8c4ab33253f04f9e870ac8c4fd7998a54b09e9b9673",
          "worktree_digest": "sha256:d1718d942aa07b9c30031fc2d0510224a30339edcf6fa605603f7a48063688e8",
          "untracked_digest": "absent"
        },
        {
          "path": "frontend/src/hooks/useAuth.ts",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:ac5b925eae20baffc6e0c303f27a9f1a40bd111fb89dc61c0605d8d12adc3e81",
          "index_digest": "sha256:ac5b925eae20baffc6e0c303f27a9f1a40bd111fb89dc61c0605d8d12adc3e81",
          "worktree_digest": "sha256:cd917c2c61a8ee2f99bbed0c71e37d000e9ebe8e59ef6bc7adab121920f88a27",
          "untracked_digest": "absent"
        },
        {
          "path": "frontend/src/lib/api.ts",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:58e5baf2ca2f9c36e3e9a3a672cb27d93d3ebf0e1549e08cb47265fb61212ce6",
          "index_digest": "sha256:58e5baf2ca2f9c36e3e9a3a672cb27d93d3ebf0e1549e08cb47265fb61212ce6",
          "worktree_digest": "sha256:613b96d6e38d90ef12afb2f0b118927403050993d705ae4a978d689a6b7bfde1",
          "untracked_digest": "absent"
        },
        {
          "path": "frontend/src/pages/BookmarksPage.tsx",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:d520f96c32d43e6ffeb82aed41354ddcb8617a6b8bd9d3e433909890e3f3782c",
          "index_digest": "sha256:d520f96c32d43e6ffeb82aed41354ddcb8617a6b8bd9d3e433909890e3f3782c",
          "worktree_digest": "sha256:2970bf61cd85d4fdf997577cddcc18b408e02e244eef44b428833a38cd5451b7",
          "untracked_digest": "absent"
        },
        {
          "path": "frontend/src/pages/CreatePostPage.tsx",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:c780e14a610344c976d04729e9aef69e1d0e7ef3e6f3184af105ee84b72a4ab6",
          "index_digest": "sha256:c780e14a610344c976d04729e9aef69e1d0e7ef3e6f3184af105ee84b72a4ab6",
          "worktree_digest": "sha256:e54b3c8b5b19babe6ed9a20fa43e634769fd67db28f58b289333989784f4df26",
          "untracked_digest": "absent"
        },
        {
          "path": "frontend/src/pages/EditPostPage.tsx",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:6c8b273af867509ed677fc664dd0c4fec74ad54c4b61c7b9e7ed131fc9b448b1",
          "index_digest": "sha256:6c8b273af867509ed677fc664dd0c4fec74ad54c4b61c7b9e7ed131fc9b448b1",
          "worktree_digest": "sha256:0356e53b7e51daf1df4a9fdaec37256a3dd84083d46f9dcb436cedddb2d53ff8",
          "untracked_digest": "absent"
        },
        {
          "path": "frontend/src/pages/HomePage.tsx",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:fb434338494cf28e3c56567cdc6dc23e28fa8346093ce593dee90b8bd80d8606",
          "index_digest": "sha256:fb434338494cf28e3c56567cdc6dc23e28fa8346093ce593dee90b8bd80d8606",
          "worktree_digest": "sha256:c66a6d2da358a1bc0482d76d15d4068f810c93b63192cfddcc540e8ac6e80117",
          "untracked_digest": "absent"
        },
        {
          "path": "frontend/src/pages/LoginPage.tsx",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:987d6d4937516220cccba09270b839f61b0bd96558e4b085c2a626888a5fb8e8",
          "index_digest": "sha256:987d6d4937516220cccba09270b839f61b0bd96558e4b085c2a626888a5fb8e8",
          "worktree_digest": "sha256:2646d2b19acbd5fcd90c2ed70ff2aae7304bc97e1870734a4ca25c74145b308e",
          "untracked_digest": "absent"
        },
        {
          "path": "frontend/src/pages/PostDetailPage.tsx",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:a8622de03fd2a69c200311fd846586f50fa130fe2d13349fdacd1b11a068ca48",
          "index_digest": "sha256:a8622de03fd2a69c200311fd846586f50fa130fe2d13349fdacd1b11a068ca48",
          "worktree_digest": "sha256:f5bbd5a912e8bb3ed50ffee9cdaaca3d7aa102cc99bc8dfe8a7d041f136aea02",
          "untracked_digest": "absent"
        },
        {
          "path": "frontend/src/pages/TagPage.tsx",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:4a594cc20ebba724d6cecf7db7d1c51f5d532943da882d0d76c57853cda4efa3",
          "index_digest": "sha256:4a594cc20ebba724d6cecf7db7d1c51f5d532943da882d0d76c57853cda4efa3",
          "worktree_digest": "sha256:3d517b4fa3b3380e83a415aa6c18ba392f630d99d34f2d05b2f9f91a1d5e1b4f",
          "untracked_digest": "absent"
        },
        {
          "path": "frontend/src/pages/admin/AdminCategoriesPage.tsx",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:bc51735aab6db5031c61ddd5e0c8c2a6e60fa1a278af5447a3832e838b558cca",
          "index_digest": "sha256:bc51735aab6db5031c61ddd5e0c8c2a6e60fa1a278af5447a3832e838b558cca",
          "worktree_digest": "sha256:ef8ab6bdf33c6e1829c9dcef087cee0569ad8ba69b5c92872c93a905f93985c6",
          "untracked_digest": "absent"
        },
        {
          "path": "frontend/src/pages/admin/AdminDashboardPage.tsx",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:b5c364cbaf4b1560911128198532550cbc5e5d9dec950bed74d8dd079c3d3516",
          "index_digest": "sha256:b5c364cbaf4b1560911128198532550cbc5e5d9dec950bed74d8dd079c3d3516",
          "worktree_digest": "sha256:1779b82523794887c16be8ef9782ba6daf8229d692c519b5b23162b000dc2efb",
          "untracked_digest": "absent"
        },
        {
          "path": "frontend/src/pages/admin/AdminModerationPage.tsx",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:f810a01b2b274c0669417701b1c016aaf5fc78a3ccf42d0f1fb6302fbd7d7644",
          "index_digest": "sha256:f810a01b2b274c0669417701b1c016aaf5fc78a3ccf42d0f1fb6302fbd7d7644",
          "worktree_digest": "sha256:ab301301954bd2319b3d229a48548af9e4b246617c90ef29dde5e5c22d9b6d0b",
          "untracked_digest": "absent"
        },
        {
          "path": "frontend/src/pages/admin/AdminReportsPage.tsx",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:6823620618869faed34ade594c9cc1361d81f862f69e1c0702a79abb2f3a9c15",
          "index_digest": "sha256:6823620618869faed34ade594c9cc1361d81f862f69e1c0702a79abb2f3a9c15",
          "worktree_digest": "sha256:4a450a3ff5158c04cd23c41f64a443f842e8bcb41787631249e469ef70a0f471",
          "untracked_digest": "absent"
        },
        {
          "path": "frontend/src/pages/admin/AdminUsersPage.tsx",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:7beaf5cc2c62b9edf62500af3a526092880fa4313679cd1e0fe4ff00fab69886",
          "index_digest": "sha256:7beaf5cc2c62b9edf62500af3a526092880fa4313679cd1e0fe4ff00fab69886",
          "worktree_digest": "sha256:8c94b7d2c922082441534b987298270a1bfa0982fb0d39205362d3a4dbc8f23d",
          "untracked_digest": "absent"
        },
        {
          "path": "frontend/src/services/adminService.ts",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:f9c1e5df829c7dd6c500aef1cd5b002cdb4d4943dda06a73fdb88969a10633bf",
          "index_digest": "sha256:f9c1e5df829c7dd6c500aef1cd5b002cdb4d4943dda06a73fdb88969a10633bf",
          "worktree_digest": "sha256:a3f93137259cc8d002fed68c299ba8c408089ec22738e68572f9d1b7b74cc22e",
          "untracked_digest": "absent"
        },
        {
          "path": "frontend/src/services/categoryService.ts",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:60c1e39afe776f01d4636827dd0f140371194629e252a404acd68368e0ff8921",
          "index_digest": "sha256:60c1e39afe776f01d4636827dd0f140371194629e252a404acd68368e0ff8921",
          "worktree_digest": "sha256:1ea476ceee48e5cbcb3a22897090b1af73e0f86bbc378205ee71ed4f7e1a1131",
          "untracked_digest": "absent"
        },
        {
          "path": "frontend/src/services/postService.ts",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:7b8a20744e75572769965f994937815605d00347fef612333017f4f4f032f5ce",
          "index_digest": "sha256:7b8a20744e75572769965f994937815605d00347fef612333017f4f4f032f5ce",
          "worktree_digest": "sha256:cbfbe9d45220c8f38ae68daba40121d6f9d18d077ae877abf3bb20826f3d1067",
          "untracked_digest": "absent"
        },
        {
          "path": "frontend/src/stores/authStore.ts",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:a6e27c9f7c2b0d33a85ba9b9d7ea05f6de592b1a9c0ce4bd16246b8b1f3cc926",
          "index_digest": "sha256:a6e27c9f7c2b0d33a85ba9b9d7ea05f6de592b1a9c0ce4bd16246b8b1f3cc926",
          "worktree_digest": "sha256:6a3ae11bef2ac7ccd3b3544c1f5f419e0c75f819a2b91789a98d0023eb01bc43",
          "untracked_digest": "absent"
        },
        {
          "path": "frontend/src/types/index.ts",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:afe2f2b6a9bbcfa47de5345d741bce0b1c0a5a7d3ed88d540782e7107d5f8f4e",
          "index_digest": "sha256:afe2f2b6a9bbcfa47de5345d741bce0b1c0a5a7d3ed88d540782e7107d5f8f4e",
          "worktree_digest": "sha256:240f4b93a6a57dce8978ea7ee9f1b255f90bf364c2d89015ac99800944407cee",
          "untracked_digest": "absent"
        },
        {
          "path": "frontend/tsconfig.json",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:00e4b9bf502c34f2f7c0673c6ede7c61b87c1c7a5b62b94af75ab4288cda4a0b",
          "index_digest": "sha256:00e4b9bf502c34f2f7c0673c6ede7c61b87c1c7a5b62b94af75ab4288cda4a0b",
          "worktree_digest": "sha256:f4245209e529cf70d766751781b172877d6aa81de7dec64e126dd33cf3329836",
          "untracked_digest": "absent"
        },
        {
          "path": "frontend/vite.config.ts",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "unstaged",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:1762c5301db3c625d2ad478a086b48d353115c76d24d1fd9b228d4b0138e731e",
          "index_digest": "sha256:1762c5301db3c625d2ad478a086b48d353115c76d24d1fd9b228d4b0138e731e",
          "worktree_digest": "sha256:e515f0f6c41dab39d770d28c86e6bbe28bc757f2d30189ff05dc23dab9debcb9",
          "untracked_digest": "absent"
        }
      ]
    },
    "primary_symbols": [
      {
        "symbol": "get_current_user",
        "file": "backend/app/api/deps.py",
        "lines": "13-32",
        "role": "JWT authentication, UUID conversion boundary, active-user gate"
      },
      {
        "symbol": "create_post",
        "file": "backend/app/api/v1/posts.py",
        "lines": "118-202",
        "role": "post persistence, excerpt generation, tag resolution and hybrid moderation"
      },
      {
        "symbol": "list_posts",
        "file": "backend/app/api/v1/posts.py",
        "lines": "205-361",
        "role": "public/staff/author visibility, filters and cursor pagination"
      },
      {
        "symbol": "get_post_detail",
        "file": "backend/app/api/v1/posts.py",
        "lines": "364-455",
        "role": "detail visibility, view mutation and response serialization"
      },
      {
        "symbol": "delete_reported_content",
        "file": "backend/app/api/v1/admin.py",
        "lines": "559-620",
        "role": "atomic moderation action across report targets"
      }
    ],
    "related_symbols": [
      {
        "symbol": "create_access_token/create_refresh_token",
        "relationship": "CALLS from auth endpoints",
        "relevance": "must add token kind and preserve expiry semantics"
      },
      {
        "symbol": "refresh",
        "relationship": "CALLS decode_token and User query",
        "relevance": "currently accepts untyped token and does not check inactive user"
      },
      {
        "symbol": "require_role",
        "relationship": "GUARDS admin/category/user/report endpoints",
        "relevance": "backend authorization boundary"
      },
      {
        "symbol": "get_optional_current_user",
        "relationship": "CALLS from public post/detail/reaction paths",
        "relevance": "must fail closed on malformed UUID"
      },
      {
        "symbol": "PostType/PostStatus/ReactionType/ReportStatus/ReportTargetType",
        "relationship": "ENUM columns and schemas",
        "relevance": "model-to-migration storage contract"
      },
      {
        "symbol": "get_comments_tree",
        "relationship": "USES post lookup",
        "relevance": "currently no visibility-aware current-user dependency"
      },
      {
        "symbol": "toggle_reaction/get_reactions",
        "relationship": "USES post lookup",
        "relevance": "currently allows lookup by bare post existence"
      },
      {
        "symbol": "toggle_bookmark/get_my_bookmarks",
        "relationship": "USES post lookup and Post filter",
        "relevance": "bookmark visibility must include status"
      },
      {
        "symbol": "get_hot_tags/get_tag",
        "relationship": "AGGREGATES post_tags/Post",
        "relevance": "count currently counts association rows despite filtered outer join"
      },
      {
        "symbol": "create_report",
        "relationship": "CREATES Report",
        "relevance": "target validation and duplicate-open-report rule"
      },
      {
        "symbol": "api",
        "relationship": "SHARED frontend Axios client",
        "relevance": "auth header and refresh retry boundary"
      },
      {
        "symbol": "useAuthStore",
        "relationship": "CONSUMED by api/useAuth/LoginPage",
        "relevance": "must persist refresh token/session"
      },
      {
        "symbol": "LoginPage",
        "relationship": "CALLS auth API",
        "relevance": "register route mismatch and temporary fake user"
      },
      {
        "symbol": "adminService",
        "relationship": "CONSUMED by admin pages/sidebar",
        "relevance": "generic fallbacks and wrong report-delete path"
      },
      {
        "symbol": "AdminReportsPage/ReportActionModal",
        "relationship": "REPORT moderation UI",
        "relevance": "must use atomic content action and handle dismissed state"
      },
      {
        "symbol": "AdminRouteGuard/AdminOnlyGuard",
        "relationship": "WRAPS /admin routes",
        "relevance": "unauthenticated redirect currently lands on / instead of login"
      },
      {
        "symbol": "PostDetailPage/AdminModerationPage",
        "relationship": "RENDERS HTML",
        "relevance": "dangerouslySetInnerHTML sinks and moderation preview"
      },
      {
        "symbol": "vite.config.ts/nginx.conf",
        "relationship": "PROXIES API/assets",
        "relevance": "/uploads path is not proxied"
      }
    ],
    "execution_path": [
      "Browser request enters Axios api client; request interceptor reads access token from persisted Zustand store.",
      "FastAPI dependency decodes JWT, parses sub as UUID, loads User, checks is_active, then optional role dependency checks RBAC.",
      "Post create sanitizes/validates content, resolves category/tags, assigns pending or approved status, and persists through SQLAlchemy.",
      "Public post reads apply approved + published visibility; owner/staff private reads use the explicit access matrix.",
      "Post detail increments view_count, commits, refreshes/reloads server-generated fields, then serializes reactions/bookmark state without implicit async lazy loads.",
      "Admin report content action mutates the target and resolves every open report for that target in one database transaction.",
      "Frontend admin pages consume typed canonical responses; a 401 invokes a single refresh/retry path, otherwise session is cleared and login redirect preserves destination.",
      "Dev Vite and production Nginx proxy both /api/ and /uploads/ to the backend; container entrypoint runs migrations before Uvicorn."
    ],
    "pdg_constraints": [
      {
        "description": "PDG unavailable: no GitNexus index or PDG layer was available. The following are source-derived control/data constraints, not graph edges.",
        "affected_statements": [],
        "implementation_consequence": "Re-run GitNexus analyze --index-only --pdg before implementation if statement-level blast radius is required; executor must re-verify each range."
      }
    ],
    "architectural_patterns": [
      {
        "pattern": "FastAPI dependency-injected AsyncSession and role guards",
        "example_location": "backend/app/api/deps.py",
        "usage_guidance": "Extend shared access helpers rather than duplicating authorization predicates in each router."
      },
      {
        "pattern": "SQLAlchemy selectinload before response serialization",
        "example_location": "backend/app/api/v1/posts.py",
        "usage_guidance": "Keep relationships explicitly loaded and never rely on async implicit lazy loads after commit."
      },
      {
        "pattern": "Relative same-origin API/assets behind frontend proxy",
        "example_location": "frontend/src/lib/api.ts",
        "usage_guidance": "Keep relative /api and /uploads URLs and configure both dev and production proxies."
      },
      {
        "pattern": "Paginated wrapper responses for admin lists",
        "example_location": "backend/app/api/v1/admin.py",
        "usage_guidance": "Use one canonical endpoint/shape; remove broad fallback retries that can duplicate mutations."
      }
    ],
    "files_to_modify": [
      {
        "file": "backend/app/models/user.py",
        "symbols": [
          "User.role"
        ],
        "intended_change": "Keep enum storage value-based and compatible with userrole migration."
      },
      {
        "file": "backend/app/models/post.py",
        "symbols": [
          "Post.post_type",
          "Post.status"
        ],
        "intended_change": "Store lowercase enum values matching Alembic labels."
      },
      {
        "file": "backend/app/models/reaction.py",
        "symbols": [
          "Reaction.reaction_type"
        ],
        "intended_change": "Store lowercase reaction values."
      },
      {
        "file": "backend/app/models/report.py",
        "symbols": [
          "Report.status",
          "Report.target_type"
        ],
        "intended_change": "Store lowercase report enum values."
      },
      {
        "file": "backend/app/api/deps.py",
        "symbols": [
          "get_current_user",
          "get_optional_current_user"
        ],
        "intended_change": "Parse UUID safely and fail closed."
      },
      {
        "file": "backend/app/core/security.py",
        "symbols": [
          "create_access_token",
          "create_refresh_token",
          "decode_token"
        ],
        "intended_change": "Add token kind and typed decode helpers."
      },
      {
        "file": "backend/app/api/v1/auth.py",
        "symbols": [
          "login",
          "register",
          "refresh"
        ],
        "intended_change": "Use typed tokens and reject inactive/incorrect token kinds."
      },
      {
        "file": "backend/app/services/post_access.py",
        "symbols": [
          "get_post_for_request",
          "can_view_post"
        ],
        "intended_change": "New shared visibility matrix."
      },
      {
        "file": "backend/app/services/content_sanitizer.py",
        "symbols": [
          "sanitize_post_html",
          "validate_post_content"
        ],
        "intended_change": "New backend HTML allowlist and URL policy."
      },
      {
        "file": "backend/app/api/v1/posts.py",
        "symbols": [
          "create_post",
          "list_posts",
          "get_post_detail",
          "update_post"
        ],
        "intended_change": "Sanitize content, use access helper, refresh after view update."
      },
      {
        "file": "backend/app/api/v1/comments.py",
        "symbols": [
          "create_comment",
          "get_comments_tree"
        ],
        "intended_change": "Apply post visibility to read/write."
      },
      {
        "file": "backend/app/api/v1/reactions.py",
        "symbols": [
          "toggle_reaction",
          "get_reactions"
        ],
        "intended_change": "Apply post visibility."
      },
      {
        "file": "backend/app/api/v1/bookmarks.py",
        "symbols": [
          "toggle_bookmark",
          "get_my_bookmarks"
        ],
        "intended_change": "Apply visibility and exclude rejected/unpublished posts."
      },
      {
        "file": "backend/app/api/v1/tags.py",
        "symbols": [
          "get_hot_tags",
          "get_tag"
        ],
        "intended_change": "Count Post.id, not association rows."
      },
      {
        "file": "backend/app/api/v1/admin.py",
        "symbols": [
          "delete_reported_content",
          "list_admin_posts"
        ],
        "intended_change": "Preserve atomic action and expose safe moderation preview path."
      },
      {
        "file": "backend/app/core/config.py",
        "symbols": [
          "Settings"
        ],
        "intended_change": "Safe env defaults, production validation and DB_ECHO."
      },
      {
        "file": "backend/app/core/database.py",
        "symbols": [
          "engine"
        ],
        "intended_change": "Use configurable SQL echo."
      },
      {
        "file": "backend/app/api/v1/upload.py",
        "symbols": [
          "upload_image"
        ],
        "intended_change": "Preserve safe relative upload response and validate URL/path policy."
      },
      {
        "file": "backend/app/schemas/user.py",
        "symbols": [
          "TokenPayload"
        ],
        "intended_change": "Represent typed token claims if schema is used."
      },
      {
        "file": "backend/app/schemas/post.py",
        "symbols": [
          "PostSummaryResponse",
          "PostDetailResponse"
        ],
        "intended_change": "Keep summary/detail contract explicit for moderation preview."
      },
      {
        "file": "backend/app/schemas/report.py",
        "symbols": [
          "ReportResponse"
        ],
        "intended_change": "Align report status/target response typing."
      },
      {
        "file": "backend/requirements.txt",
        "symbols": [],
        "intended_change": "Add sanitizer dependency and retain reproducible test packages."
      },
      {
        "file": "backend/Dockerfile",
        "symbols": [],
        "intended_change": "Install/use migration entrypoint."
      },
      {
        "file": "backend/docker-entrypoint.sh",
        "symbols": [],
        "intended_change": "New migration-before-server entrypoint."
      },
      {
        "file": "backend/app/create_admin.py",
        "symbols": [
          "create_admin"
        ],
        "intended_change": "Remove hardcoded credentials."
      },
      {
        "file": "frontend/src/services/authService.ts",
        "symbols": [
          "login",
          "register",
          "refresh",
          "getMe"
        ],
        "intended_change": "New typed auth client."
      },
      {
        "file": "frontend/src/lib/api.ts",
        "symbols": [
          "api"
        ],
        "intended_change": "Single-flight refresh and one retry on 401."
      },
      {
        "file": "frontend/src/stores/authStore.ts",
        "symbols": [
          "useAuthStore"
        ],
        "intended_change": "Persist access + refresh token session."
      },
      {
        "file": "frontend/src/services/adminService.ts",
        "symbols": [
          "adminService"
        ],
        "intended_change": "Use canonical endpoints and atomic report deletion."
      },
      {
        "file": "frontend/src/pages/LoginPage.tsx",
        "symbols": [
          "LoginPage"
        ],
        "intended_change": "Call /auth/register and use typed session flow."
      },
      {
        "file": "frontend/src/lib/sanitizeHtml.ts",
        "symbols": [
          "sanitizeHtml"
        ],
        "intended_change": "New client-side defense-in-depth sanitizer."
      },
      {
        "file": "frontend/src/pages/PostDetailPage.tsx",
        "symbols": [
          "PostDetailPage"
        ],
        "intended_change": "Render sanitized HTML."
      },
      {
        "file": "frontend/src/pages/admin/AdminReportsPage.tsx",
        "symbols": [
          "AdminReportsPage"
        ],
        "intended_change": "Call one report-content endpoint and model all statuses."
      },
      {
        "file": "frontend/src/components/admin/ReportActionModal.tsx",
        "symbols": [
          "ReportActionModal"
        ],
        "intended_change": "Use report ID callback and closed-status handling."
      },
      {
        "file": "frontend/src/pages/EditPostPage.tsx",
        "symbols": [
          "EditPostPage"
        ],
        "intended_change": "Use auth state for login guard."
      },
      {
        "file": "frontend/vite.config.ts",
        "symbols": [],
        "intended_change": "Proxy /uploads in dev."
      },
      {
        "file": "frontend/nginx.conf",
        "symbols": [],
        "intended_change": "Proxy /uploads with ^~ before static regex."
      },
      {
        "file": "frontend/Dockerfile",
        "symbols": [],
        "intended_change": "Use npm ci after lockfile is committed."
      }
    ],
    "tests": [
      {
        "file": "backend/tests/test_auth.py",
        "scenarios": [
          "POST /auth/register with valid UserCreate → 201 TokenResponse",
          "malformed JWT sub → 401, not 500",
          "access token sent to /auth/refresh → 401",
          "inactive login/refresh → rejected",
          "valid refresh → new access and refresh tokens"
        ]
      },
      {
        "file": "backend/tests/test_posts.py",
        "scenarios": [
          "two public detail reads → 200 and view_count 1 then 2",
          "post HTML containing script/javascript/data payload → stored/returned HTML has no dangerous nodes",
          "unpublished approved post → hidden from anonymous/other user, allowed only by matrix"
        ]
      },
      {
        "file": "backend/tests/test_moderation.py",
        "scenarios": [
          "pending/rejected/unpublished matrix across feed/detail/comments/reactions/bookmarks",
          "owner and staff can inspect pending post; unrelated user receives 404"
        ]
      },
      {
        "file": "backend/tests/test_tags_categories.py",
        "scenarios": [
          "one approved plus pending/unpublished associations → hot/tag count includes only approved published rows"
        ]
      },
      {
        "file": "backend/tests/test_reports.py",
        "scenarios": [
          "atomic delete for post/comment/user → target action and all open reports resolve in one response",
          "frontend contract-compatible PUT/PATCH resolve remains typed"
        ]
      },
      {
        "file": "backend/tests/test_adversarial_backend.py",
        "scenarios": [
          "retain cursor/comment/reaction/bookmark/upload adversarial coverage after shared helper changes"
        ]
      },
      {
        "file": "backend/tests/test_migrations.py",
        "scenarios": [
          "fresh PostgreSQL alembic upgrade → enum labels and representative inserts/reads match lowercase values",
          "legacy uppercase enum labels, if present → controlled normalization or explicit fail-fast"
        ]
      },
      {
        "file": "frontend/src/services/authService.test.ts",
        "scenarios": [
          "register posts to /auth/register, not /users/",
          "login/me/refresh preserve access and refresh tokens"
        ]
      },
      {
        "file": "frontend/src/lib/api.test.ts",
        "scenarios": [
          "401 with refresh token → refresh once and replay original request",
          "concurrent 401s share one refresh promise",
          "refresh failure or auth endpoint 401 → logout without loop"
        ]
      },
      {
        "file": "frontend/src/pages/admin/AdminReportsPage.test.tsx",
        "scenarios": [
          "delete-content action calls /admin/reports/{id}/content exactly once",
          "dismissed report is shown as closed and cannot be acted on as open"
        ]
      },
      {
        "file": "frontend/src/lib/sanitizeHtml.test.ts",
        "scenarios": [
          "script/event/javascript/data URLs removed while allowed TipTap formatting remains"
        ]
      },
      {
        "file": "frontend/src/components/admin/AdminRouteGuard.test.tsx",
        "scenarios": [
          "anonymous /admin → /login with return location",
          "user role → denied route",
          "moderator/admin → nested admin outlet"
        ]
      },
      {
        "file": "frontend/src/components/admin/PaginationControls.test.tsx",
        "scenarios": [
          "first/last/next/previous disabled states and page changes match total"
        ]
      },
      {
        "file": ".github/workflows/ci.yml",
        "scenarios": [
          "backend dependency install + pytest",
          "frontend npm ci + lint/build/test",
          "compose config/migration smoke gate"
        ]
      }
    ],
    "verification_commands": [
      "python -m compileall -q backend/app backend/tests",
      "python -m pytest -q",
      "npm run build",
      "npm run lint",
      "docker compose config"
    ],
    "risks": [
      "Enum normalization can fail on a database created outside Alembic; inspect pg_enum and take a backup before production migration.",
      "Adding token kind invalidates old untyped sessions; make forced re-login explicit in release notes.",
      "HTML sanitizer may strip legitimate rich text; use allowlist fixtures and review link/image protocols.",
      "Visibility changes affect pending-post owner interactions and bookmarks; validate the full matrix before release.",
      "Refresh retry concurrency can create loops or lose the original request; test single-flight and auth-endpoint exclusions.",
      "Docker migration entrypoint must be idempotent and must not seed a demo admin password automatically."
    ],
    "assumptions": [
      "PostgreSQL is the production database; SQLite remains a fast unit/integration test backend.",
      "A post is public only when status=approved and is_published=true; owner/staff private access is intentional.",
      "Existing sessions may be invalidated when token kind claims are introduced.",
      "Local uploads remain on the mounted volume for this fix; object storage is deferred.",
      "The current repo has no frontend lockfile, ESLint config, frontend test script, or CI workflow; create them as part of verification."
    ],
    "open_questions": [
      "Confirm whether authors may comment/react/bookmark their own pending post; recommended: owner may view/edit but only approved posts accept community interactions.",
      "Confirm whether a deployed database was ever created with Base.metadata.create_all instead of Alembic; this decides whether 0003 needs legacy enum repair.",
      "Choose the approved sanitizer library/version and exact TipTap allowlist after reviewing existing authored content.",
      "Confirm production secret delivery and allowed CORS origins before enabling the production fail-fast validator.",
      "Decide whether the CI PostgreSQL service is mandatory for merge or initially a nightly/integration gate."
    ],
    "avoid": [
      "Do not repeat full repository discovery.",
      "Do not replace established patterns without evidence.",
      "Do not disable strict TypeScript noUnusedLocals/noUnusedParameters to hide build errors.",
      "Do not keep broad catch-all endpoint fallbacks for mutations; a timeout after a successful mutation can duplicate state changes.",
      "Do not render raw post HTML or trust client-only sanitization.",
      "Do not edit already-applied Alembic revisions unless deployment history proves they are not shared; add a new corrective revision.",
      "Do not auto-create the hardcoded admin123 account in dev/prod startup.",
      "Do not use a broad recursive delete or reset user worktree state while implementing the plan."
    ],
    "work_breakdown": [
      {
        "id": "G0",
        "name": "Baseline and decision gates",
        "depends_on": [],
        "parallel_with": [],
        "tasks": [
          {
            "id": "T0.1",
            "title": "Re-anchor baseline and preserve failing evidence",
            "files": [],
            "test_ids": [
              "BASE-01",
              "BASE-02"
            ],
            "gate": "HEAD, source diff, failing commands and environment are recorded."
          },
          {
            "id": "T0.2",
            "title": "Inspect deployed database lineage",
            "files": [
              "backend/alembic/versions/0001_phase2_content_community.py",
              "backend/alembic/versions/0002_phase3_admin_moderation.py"
            ],
            "test_ids": [
              "DB-LEGACY-01"
            ],
            "gate": "alembic_version and pg_enum evidence decides whether 0003 is needed."
          },
          {
            "id": "T0.3",
            "title": "Confirm product policy decisions",
            "files": [],
            "test_ids": [
              "POLICY-01"
            ],
            "gate": "Pending-content interaction matrix, token rollout and sanitizer allowlist are approved."
          }
        ]
      },
      {
        "id": "G1",
        "name": "Database enum and async ORM correctness",
        "depends_on": [
          "G0"
        ],
        "parallel_with": [
          "G2"
        ],
        "tasks": [
          {
            "id": "T1.1",
            "title": "Map SQLAlchemy enums to lowercase values",
            "files": [
              "backend/app/models/user.py",
              "backend/app/models/post.py",
              "backend/app/models/reaction.py",
              "backend/app/models/report.py"
            ],
            "test_ids": [
              "DB-ENUM-01",
              "DB-ENUM-02"
            ],
            "gate": "All representative ORM writes/readbacks use lowercase labels."
          },
          {
            "id": "T1.2",
            "title": "Add conditional legacy enum migration when required",
            "files": [
              "backend/alembic/versions/0003_enum_value_alignment.py"
            ],
            "test_ids": [
              "DB-MIG-01",
              "DB-MIG-02",
              "DB-MIG-03"
            ],
            "gate": "Fresh schema is a no-op; proven legacy schema is repaired or fails diagnostically."
          },
          {
            "id": "T1.3",
            "title": "Remove implicit async IO from post detail",
            "files": [
              "backend/app/api/v1/posts.py"
            ],
            "test_ids": [
              "DB-ASYNC-01",
              "DB-ASYNC-02"
            ],
            "gate": "Two detail reads return 200, increment views, and never raise MissingGreenlet."
          }
        ]
      },
      {
        "id": "G2",
        "name": "Backend authentication and token lifecycle",
        "depends_on": [
          "G0"
        ],
        "parallel_with": [
          "G1"
        ],
        "tasks": [
          {
            "id": "T2.1",
            "title": "Add access/refresh token kind claims",
            "files": [
              "backend/app/core/security.py",
              "backend/app/schemas/user.py"
            ],
            "test_ids": [
              "AUTH-03",
              "AUTH-06",
              "AUTH-07"
            ],
            "gate": "Access and refresh tokens are distinguishable and validated at the correct boundary."
          },
          {
            "id": "T2.2",
            "title": "Parse JWT subject as UUID and fail closed",
            "files": [
              "backend/app/api/deps.py"
            ],
            "test_ids": [
              "AUTH-05",
              "AUTH-09"
            ],
            "gate": "Malformed subjects yield 401/anonymous behavior, never 500."
          },
          {
            "id": "T2.3",
            "title": "Reject inactive login and refresh",
            "files": [
              "backend/app/api/v1/auth.py"
            ],
            "test_ids": [
              "AUTH-04",
              "AUTH-08"
            ],
            "gate": "Inactive accounts cannot obtain or rotate credentials."
          },
          {
            "id": "T2.4",
            "title": "Add auth regression suite",
            "files": [
              "backend/tests/test_auth.py",
              "backend/tests/conftest.py"
            ],
            "test_ids": [
              "AUTH-01",
              "AUTH-02",
              "AUTH-03",
              "AUTH-04",
              "AUTH-05",
              "AUTH-06",
              "AUTH-07",
              "AUTH-08",
              "AUTH-09"
            ],
            "gate": "Auth test module passes in isolation and under full backend suite."
          }
        ]
      },
      {
        "id": "G3",
        "name": "Frontend authentication and route guards",
        "depends_on": [
          "G2"
        ],
        "parallel_with": [
          "G6",
          "G7"
        ],
        "tasks": [
          {
            "id": "T3.1",
            "title": "Create typed auth service",
            "files": [
              "frontend/src/services/authService.ts",
              "frontend/src/types/index.ts"
            ],
            "test_ids": [
              "FEAUTH-01",
              "FEAUTH-02"
            ],
            "gate": "Register/login/me/refresh have typed request and response contracts."
          },
          {
            "id": "T3.2",
            "title": "Persist atomic access/refresh session",
            "files": [
              "frontend/src/stores/authStore.ts",
              "frontend/src/hooks/useAuth.ts"
            ],
            "test_ids": [
              "FEAUTH-02"
            ],
            "gate": "Old persisted state migrates safely and logout clears both tokens."
          },
          {
            "id": "T3.3",
            "title": "Implement one-shot single-flight refresh",
            "files": [
              "frontend/src/lib/api.ts"
            ],
            "test_ids": [
              "FEAUTH-03",
              "FEAUTH-04",
              "FEAUTH-05",
              "FEAUTH-06"
            ],
            "gate": "No infinite loop; concurrent 401s produce one refresh request."
          },
          {
            "id": "T3.4",
            "title": "Fix register/login and protected navigation",
            "files": [
              "frontend/src/pages/LoginPage.tsx",
              "frontend/src/components/admin/AdminRouteGuard.tsx",
              "frontend/src/components/admin/AdminOnlyGuard.tsx",
              "frontend/src/pages/EditPostPage.tsx"
            ],
            "test_ids": [
              "FEAUTH-01",
              "FEAUTH-07",
              "FEAUTH-08",
              "FEAUTH-09"
            ],
            "gate": "Anonymous users land on login with return path; authorized roles continue."
          }
        ]
      },
      {
        "id": "G4",
        "name": "Unified post visibility policy",
        "depends_on": [
          "G1",
          "G2",
          "G0/T0.3"
        ],
        "parallel_with": [
          "G6",
          "G7"
        ],
        "tasks": [
          {
            "id": "T4.1",
            "title": "Implement post access policy helper",
            "files": [
              "backend/app/services/post_access.py"
            ],
            "test_ids": [
              "VIS-01",
              "VIS-08"
            ],
            "gate": "One documented matrix controls public read, private read and interaction eligibility."
          },
          {
            "id": "T4.2",
            "title": "Apply policy to post list/detail",
            "files": [
              "backend/app/api/v1/posts.py"
            ],
            "test_ids": [
              "VIS-01",
              "VIS-07",
              "DB-ASYNC-01"
            ],
            "gate": "Public, owner and staff queries return only their intended state set."
          },
          {
            "id": "T4.3",
            "title": "Apply policy to comments",
            "files": [
              "backend/app/api/v1/comments.py"
            ],
            "test_ids": [
              "VIS-02",
              "VIS-04"
            ],
            "gate": "Hidden post comments cannot leak or accept unauthorized writes."
          },
          {
            "id": "T4.4",
            "title": "Apply policy to reactions",
            "files": [
              "backend/app/api/v1/reactions.py"
            ],
            "test_ids": [
              "VIS-03",
              "VIS-05"
            ],
            "gate": "Reaction counts/mutations obey visibility and interaction state."
          },
          {
            "id": "T4.5",
            "title": "Apply policy to bookmarks",
            "files": [
              "backend/app/api/v1/bookmarks.py"
            ],
            "test_ids": [
              "VIS-06"
            ],
            "gate": "Removed/rejected posts do not appear in bookmark feed."
          },
          {
            "id": "T4.6",
            "title": "Add actor-by-state matrix tests",
            "files": [
              "backend/tests/test_moderation.py",
              "backend/tests/test_comments.py",
              "backend/tests/test_reactions.py",
              "backend/tests/test_bookmarks.py"
            ],
            "test_ids": [
              "VIS-01",
              "VIS-02",
              "VIS-03",
              "VIS-04",
              "VIS-05",
              "VIS-06",
              "VIS-07",
              "VIS-08"
            ],
            "gate": "All matrix rows pass without weakening existing RBAC assertions."
          }
        ]
      },
      {
        "id": "G5",
        "name": "Stored HTML and render-sink safety",
        "depends_on": [
          "G1",
          "G4"
        ],
        "parallel_with": [],
        "tasks": [
          {
            "id": "T5.1",
            "title": "Define backend sanitizer allowlist",
            "files": [
              "backend/app/services/content_sanitizer.py",
              "backend/requirements.txt"
            ],
            "test_ids": [
              "XSS-01",
              "XSS-02",
              "XSS-03",
              "XSS-04",
              "XSS-05"
            ],
            "gate": "Dangerous nodes/attributes/protocols are removed while TipTap markup survives."
          },
          {
            "id": "T5.2",
            "title": "Sanitize create and update paths",
            "files": [
              "backend/app/api/v1/posts.py"
            ],
            "test_ids": [
              "XSS-06",
              "XSS-07"
            ],
            "gate": "Only sanitized non-empty HTML is persisted."
          },
          {
            "id": "T5.3",
            "title": "Protect legacy content and plan backfill",
            "files": [
              "backend/app/api/v1/posts.py",
              "backend/alembic/versions/0004_sanitize_existing_posts.py"
            ],
            "test_ids": [
              "XSS-08"
            ],
            "gate": "Pre-existing unsafe rows cannot reach any full-content response."
          },
          {
            "id": "T5.4",
            "title": "Add frontend render sanitizer",
            "files": [
              "frontend/src/lib/sanitizeHtml.ts",
              "frontend/src/pages/PostDetailPage.tsx"
            ],
            "test_ids": [
              "XSS-09"
            ],
            "gate": "Browser render sink receives sanitized HTML."
          },
          {
            "id": "T5.5",
            "title": "Load safe full content in moderation preview",
            "files": [
              "frontend/src/pages/admin/AdminModerationPage.tsx",
              "frontend/src/services/adminService.ts"
            ],
            "test_ids": [
              "XSS-10"
            ],
            "gate": "Preview is populated from full detail and cannot execute unsafe markup."
          }
        ]
      },
      {
        "id": "G6",
        "name": "Public tag aggregation",
        "depends_on": [
          "G1"
        ],
        "parallel_with": [
          "G3",
          "G4",
          "G7"
        ],
        "tasks": [
          {
            "id": "T6.1",
            "title": "Count filtered Post rows",
            "files": [
              "backend/app/api/v1/tags.py"
            ],
            "test_ids": [
              "TAG-01",
              "TAG-02",
              "TAG-03"
            ],
            "gate": "Only approved+published posts contribute and order is stable."
          },
          {
            "id": "T6.2",
            "title": "Extend tag/category regression tests",
            "files": [
              "backend/tests/test_tags_categories.py",
              "backend/tests/test_adversarial_backend.py"
            ],
            "test_ids": [
              "TAG-01",
              "TAG-02",
              "TAG-03"
            ],
            "gate": "Tag tests pass with mixed post states."
          }
        ]
      },
      {
        "id": "G7",
        "name": "Atomic report moderation",
        "depends_on": [
          "G1",
          "G2"
        ],
        "parallel_with": [
          "G3",
          "G4",
          "G6"
        ],
        "tasks": [
          {
            "id": "T7.1",
            "title": "Harden atomic backend content action",
            "files": [
              "backend/app/api/v1/admin.py",
              "backend/app/schemas/report.py"
            ],
            "test_ids": [
              "REP-01",
              "REP-02",
              "REP-03",
              "REP-04",
              "REP-05",
              "REP-06"
            ],
            "gate": "One transaction handles every target type and report closure."
          },
          {
            "id": "T7.2",
            "title": "Remove frontend mutation fallbacks",
            "files": [
              "frontend/src/services/adminService.ts"
            ],
            "test_ids": [
              "FEREP-01"
            ],
            "gate": "Each action maps to one canonical endpoint and errors are surfaced."
          },
          {
            "id": "T7.3",
            "title": "Update report page/modal state machine",
            "files": [
              "frontend/src/pages/admin/AdminReportsPage.tsx",
              "frontend/src/components/admin/ReportActionModal.tsx"
            ],
            "test_ids": [
              "FEREP-01",
              "FEREP-02"
            ],
            "gate": "Open/resolved/dismissed states render and act correctly."
          },
          {
            "id": "T7.4",
            "title": "Add backend and frontend report tests",
            "files": [
              "backend/tests/test_reports.py",
              "frontend/src/pages/admin/AdminReportsPage.test.tsx"
            ],
            "test_ids": [
              "REP-01",
              "REP-02",
              "REP-03",
              "REP-04",
              "REP-05",
              "REP-06",
              "FEREP-01",
              "FEREP-02"
            ],
            "gate": "Target actions and exact frontend request counts pass."
          }
        ]
      },
      {
        "id": "G8",
        "name": "Frontend compiler, lint, tests and pagination",
        "depends_on": [
          "G3",
          "G7"
        ],
        "parallel_with": [],
        "tasks": [
          {
            "id": "T8.1",
            "title": "Resolve all strict TypeScript errors",
            "files": [
              "frontend/src"
            ],
            "test_ids": [
              "FEQ-01"
            ],
            "gate": "npm run build completes without changing strict flags."
          },
          {
            "id": "T8.2",
            "title": "Wire or remove dead loading/page/total state",
            "files": [
              "frontend/src/pages/admin"
            ],
            "test_ids": [
              "FEQ-04"
            ],
            "gate": "No dead state; retained pagination is usable and tested."
          },
          {
            "id": "T8.3",
            "title": "Add ESLint configuration and dependencies",
            "files": [
              "frontend/package.json",
              "frontend/.eslintrc.cjs"
            ],
            "test_ids": [
              "FEQ-02"
            ],
            "gate": "npm run lint exits 0 with zero warnings."
          },
          {
            "id": "T8.4",
            "title": "Add Vitest setup and focused test suites",
            "files": [
              "frontend/package.json",
              "frontend/src/test/setup.ts"
            ],
            "test_ids": [
              "FEQ-03"
            ],
            "gate": "npm test -- --run exits 0."
          },
          {
            "id": "T8.5",
            "title": "Commit lockfile and switch Docker to npm ci",
            "files": [
              "frontend/package-lock.json",
              "frontend/Dockerfile"
            ],
            "test_ids": [
              "FEQ-05",
              "FEQ-06"
            ],
            "gate": "Clean install/build is reproducible; audit is reviewed."
          }
        ]
      },
      {
        "id": "G9",
        "name": "Upload proxy and same-origin assets",
        "depends_on": [
          "G8"
        ],
        "parallel_with": [],
        "tasks": [
          {
            "id": "T9.1",
            "title": "Proxy uploads in Vite",
            "files": [
              "frontend/vite.config.ts"
            ],
            "test_ids": [
              "UP-03"
            ],
            "gate": "Dev frontend returns uploaded asset through port 3000."
          },
          {
            "id": "T9.2",
            "title": "Proxy uploads in Nginx with precedence",
            "files": [
              "frontend/nginx.conf"
            ],
            "test_ids": [
              "UP-04",
              "UP-05"
            ],
            "gate": "Production Nginx ^~ proxy wins over static file regex."
          },
          {
            "id": "T9.3",
            "title": "Run upload security and retrieval smoke",
            "files": [
              "backend/tests/test_upload.py"
            ],
            "test_ids": [
              "UP-01",
              "UP-02",
              "UP-03",
              "UP-04",
              "UP-05"
            ],
            "gate": "Upload validation and both delivery paths pass."
          }
        ]
      },
      {
        "id": "G10",
        "name": "Secure config and Docker bootstrap",
        "depends_on": [
          "G1",
          "G2",
          "G9"
        ],
        "parallel_with": [],
        "tasks": [
          {
            "id": "T10.1",
            "title": "Add environment-aware settings",
            "files": [
              "backend/app/core/config.py",
              "backend/app/core/database.py",
              ".env.example"
            ],
            "test_ids": [
              "OPS-01",
              "OPS-02",
              "OPS-05"
            ],
            "gate": "Dev defaults work; prod rejects unsafe/missing values."
          },
          {
            "id": "T10.2",
            "title": "Run Alembic before Uvicorn",
            "files": [
              "backend/docker-entrypoint.sh",
              "backend/Dockerfile"
            ],
            "test_ids": [
              "OPS-03",
              "OPS-04",
              "OPS-07"
            ],
            "gate": "Fresh and restarted containers become healthy with head migration."
          },
          {
            "id": "T10.3",
            "title": "Align Compose dev/prod contracts",
            "files": [
              "docker-compose.yml",
              "docker-compose.prod.yml"
            ],
            "test_ids": [
              "OPS-01",
              "OPS-02",
              "OPS-03",
              "OPS-04"
            ],
            "gate": "docker compose config and production fail-fast checks behave as documented."
          },
          {
            "id": "T10.4",
            "title": "Remove hardcoded admin credentials",
            "files": [
              "backend/app/create_admin.py"
            ],
            "test_ids": [
              "OPS-06"
            ],
            "gate": "Admin creation requires explicit secret input and uses shared hasher."
          },
          {
            "id": "T10.5",
            "title": "Update operator documentation",
            "files": [
              "README.md",
              "PROJECT.md",
              ".env.example"
            ],
            "test_ids": [
              "OPS-07"
            ],
            "gate": "A new developer/operator can follow dev, prod, migration, admin and rollback steps."
          }
        ]
      },
      {
        "id": "G11",
        "name": "CI, end-to-end smoke and release gate",
        "depends_on": [
          "G5",
          "G6",
          "G7",
          "G8",
          "G9",
          "G10"
        ],
        "parallel_with": [],
        "tasks": [
          {
            "id": "T11.1",
            "title": "Add backend/frontend CI jobs",
            "files": [
              ".github/workflows/ci.yml"
            ],
            "test_ids": [
              "CI-01",
              "CI-02"
            ],
            "gate": "Both jobs pass from clean dependency installs."
          },
          {
            "id": "T11.2",
            "title": "Add PostgreSQL migration job",
            "files": [
              ".github/workflows/ci.yml",
              "backend/tests/test_migrations.py"
            ],
            "test_ids": [
              "CI-03",
              "DB-MIG-01"
            ],
            "gate": "Fresh PostgreSQL upgrades and enum roundtrips pass."
          },
          {
            "id": "T11.3",
            "title": "Add full product smoke flow",
            "files": [
              "scripts/smoke-healthcare-forum.ps1"
            ],
            "test_ids": [
              "E2E-01"
            ],
            "gate": "Register→moderate→interact→report/delete→upload flow passes."
          },
          {
            "id": "T11.4",
            "title": "Run release and rollback checklist",
            "files": [
              "README.md"
            ],
            "test_ids": [
              "REL-01"
            ],
            "gate": "Backup, migration, health, smoke, rollback and audit evidence are attached."
          }
        ]
      }
    ],
    "test_catalog": [
      {
        "id": "BASE-01",
        "layer": "baseline",
        "file": "repository",
        "scenario": "git status/HEAD and source diff captured before implementation",
        "expected": "Only known plan/user changes are present; source baseline is pinned."
      },
      {
        "id": "BASE-02",
        "layer": "baseline",
        "file": "backend+frontend",
        "scenario": "Run existing compile/test/build/lint/compose commands",
        "expected": "Known failures are reproduced and recorded before fixes."
      },
      {
        "id": "DB-LEGACY-01",
        "layer": "PostgreSQL",
        "file": "database inspection",
        "scenario": "Inspect alembic_version and pg_enum for five application enum types",
        "expected": "Database lineage and exact labels are known before migration authoring."
      },
      {
        "id": "POLICY-01",
        "layer": "product gate",
        "file": "plan §12",
        "scenario": "Approve pending-content interaction, token invalidation, sanitizer and CI policy",
        "expected": "No implementation task depends on an unresolved behavioral choice."
      },
      {
        "id": "DB-ENUM-01",
        "layer": "unit",
        "file": "backend/app/models/*",
        "scenario": "Compile/bind every enum member through SQLAlchemy type",
        "expected": "Bound database value equals lowercase member value."
      },
      {
        "id": "DB-ENUM-02",
        "layer": "integration",
        "file": "backend tests",
        "scenario": "Insert/read Post, Reaction and Report with every enum value",
        "expected": "Roundtrip succeeds and API emits lowercase values."
      },
      {
        "id": "DB-MIG-01",
        "layer": "PostgreSQL",
        "file": "backend/tests/test_migrations.py",
        "scenario": "Empty database → alembic upgrade head",
        "expected": "Upgrade succeeds and enum labels exactly match model values."
      },
      {
        "id": "DB-MIG-02",
        "layer": "PostgreSQL",
        "file": "0003 migration",
        "scenario": "Canonical lowercase schema → run corrective migration",
        "expected": "No-op; data and labels unchanged."
      },
      {
        "id": "DB-MIG-03",
        "layer": "PostgreSQL",
        "file": "0003 migration",
        "scenario": "Known uppercase legacy labels → run corrective migration",
        "expected": "Labels are renamed safely; mixed uppercase/lowercase state fails diagnostically."
      },
      {
        "id": "DB-ASYNC-01",
        "layer": "API",
        "file": "backend/tests/test_posts.py",
        "scenario": "GET approved post detail twice",
        "expected": "200 twice; view_count increments 1 then 2; updated_at serializes."
      },
      {
        "id": "DB-ASYNC-02",
        "layer": "API",
        "file": "backend/tests/test_posts.py",
        "scenario": "Run post detail under AsyncSession with server-on-update field",
        "expected": "No MissingGreenlet or implicit lazy IO."
      },
      {
        "id": "AUTH-01",
        "layer": "API",
        "file": "backend/tests/test_auth.py",
        "scenario": "Valid POST /api/v1/auth/register",
        "expected": "201 with access_token, refresh_token, bearer type."
      },
      {
        "id": "AUTH-02",
        "layer": "API",
        "file": "backend/tests/test_auth.py",
        "scenario": "Duplicate email or username registration",
        "expected": "400 with stable detail; no user inserted."
      },
      {
        "id": "AUTH-03",
        "layer": "API",
        "file": "backend/tests/test_auth.py",
        "scenario": "Active user login",
        "expected": "200; access token has type=access and refresh token type=refresh."
      },
      {
        "id": "AUTH-04",
        "layer": "API",
        "file": "backend/tests/test_auth.py",
        "scenario": "Inactive user login",
        "expected": "403; no tokens returned."
      },
      {
        "id": "AUTH-05",
        "layer": "API",
        "file": "backend/tests/test_auth.py",
        "scenario": "Access token with malformed UUID sub",
        "expected": "401, never 500/StatementError."
      },
      {
        "id": "AUTH-06",
        "layer": "API",
        "file": "backend/tests/test_auth.py",
        "scenario": "Send access token to refresh endpoint",
        "expected": "401 invalid refresh token."
      },
      {
        "id": "AUTH-07",
        "layer": "API",
        "file": "backend/tests/test_auth.py",
        "scenario": "Send valid refresh token",
        "expected": "200 with rotated access+refresh pair and correct token kinds."
      },
      {
        "id": "AUTH-08",
        "layer": "API",
        "file": "backend/tests/test_auth.py",
        "scenario": "Deactivate user then refresh",
        "expected": "403; no new tokens."
      },
      {
        "id": "AUTH-09",
        "layer": "API",
        "file": "backend/tests/test_auth.py",
        "scenario": "Optional auth receives invalid/malformed token",
        "expected": "Public route behaves anonymous without 500."
      },
      {
        "id": "FEAUTH-01",
        "layer": "frontend unit",
        "file": "frontend/src/services/authService.test.ts",
        "scenario": "Submit registration",
        "expected": "POST /auth/register exactly once; never /users/."
      },
      {
        "id": "FEAUTH-02",
        "layer": "frontend unit",
        "file": "frontend auth store tests",
        "scenario": "Login/refresh/logout session transitions",
        "expected": "Both tokens persist/rotate/clear atomically; old state migrates."
      },
      {
        "id": "FEAUTH-03",
        "layer": "frontend unit",
        "file": "frontend/src/lib/api.test.ts",
        "scenario": "Protected request returns 401 then refresh succeeds",
        "expected": "One refresh and one replay; caller receives replay response."
      },
      {
        "id": "FEAUTH-04",
        "layer": "frontend unit",
        "file": "frontend/src/lib/api.test.ts",
        "scenario": "Three concurrent requests return 401",
        "expected": "Exactly one refresh promise; all requests replay once."
      },
      {
        "id": "FEAUTH-05",
        "layer": "frontend unit",
        "file": "frontend/src/lib/api.test.ts",
        "scenario": "Refresh request fails",
        "expected": "Session cleared once; redirect to /login preserves original path."
      },
      {
        "id": "FEAUTH-06",
        "layer": "frontend unit",
        "file": "frontend/src/lib/api.test.ts",
        "scenario": "Login/register/refresh endpoint itself returns 401",
        "expected": "No recursive refresh or retry loop."
      },
      {
        "id": "FEAUTH-07",
        "layer": "frontend component",
        "file": "AdminRouteGuard.test.tsx",
        "scenario": "Anonymous visits /admin",
        "expected": "Redirect /login with from=/admin."
      },
      {
        "id": "FEAUTH-08",
        "layer": "frontend component",
        "file": "AdminRouteGuard.test.tsx",
        "scenario": "user, moderator, admin visit admin routes",
        "expected": "User denied; moderator/admin permitted; admin-only route remains admin-only."
      },
      {
        "id": "FEAUTH-09",
        "layer": "frontend component",
        "file": "EditPostPage tests",
        "scenario": "Anonymous visits edit route",
        "expected": "Redirect login before loading/editing data."
      },
      {
        "id": "VIS-01",
        "layer": "API matrix",
        "file": "test_moderation.py",
        "scenario": "GET post detail for 5 actors × 4 states",
        "expected": "Public state is 200 for all; non-public is 200 only owner/mod/admin and 404 otherwise."
      },
      {
        "id": "VIS-02",
        "layer": "API matrix",
        "file": "test_comments.py",
        "scenario": "GET comments for 5 actors × 4 states",
        "expected": "Same read visibility as detail; no hidden post leakage."
      },
      {
        "id": "VIS-03",
        "layer": "API matrix",
        "file": "test_reactions.py",
        "scenario": "GET reaction counts for 5 actors × 4 states",
        "expected": "Same read visibility as detail."
      },
      {
        "id": "VIS-04",
        "layer": "API matrix",
        "file": "test_comments.py",
        "scenario": "POST comment on public/non-public states",
        "expected": "Anonymous 401; public authenticated 201; unrelated hidden 404; visible-but-noninteractive owner/staff follows approved policy decision."
      },
      {
        "id": "VIS-05",
        "layer": "API matrix",
        "file": "test_reactions.py",
        "scenario": "Toggle reaction on public/non-public states",
        "expected": "Public authenticated succeeds; hidden state cannot be mutated outside approved policy."
      },
      {
        "id": "VIS-06",
        "layer": "API matrix",
        "file": "test_bookmarks.py",
        "scenario": "Bookmark then reject/unpublish post",
        "expected": "Hidden post is absent from bookmark feed; toggle semantics remain deterministic."
      },
      {
        "id": "VIS-07",
        "layer": "API",
        "file": "test_moderation.py",
        "scenario": "Author/staff list posts with status filters",
        "expected": "Own/staff private statuses are available without leaking to public queries."
      },
      {
        "id": "VIS-08",
        "layer": "API",
        "file": "test_moderation.py",
        "scenario": "Guess UUID/slug of hidden post as unrelated/anonymous",
        "expected": "404, not 403 or metadata-bearing response."
      },
      {
        "id": "XSS-01",
        "layer": "backend unit/API",
        "file": "sanitizer tests",
        "scenario": "Content contains script element",
        "expected": "Script removed before storage and response."
      },
      {
        "id": "XSS-02",
        "layer": "backend unit/API",
        "file": "sanitizer tests",
        "scenario": "Image/link contains onerror/onclick",
        "expected": "Event attributes removed."
      },
      {
        "id": "XSS-03",
        "layer": "backend unit/API",
        "file": "sanitizer tests",
        "scenario": "Anchor uses javascript: URL",
        "expected": "Unsafe href removed/rejected."
      },
      {
        "id": "XSS-04",
        "layer": "backend unit/API",
        "file": "sanitizer tests",
        "scenario": "Image uses data: URL",
        "expected": "Unsafe src removed/rejected; /uploads path remains allowed."
      },
      {
        "id": "XSS-05",
        "layer": "backend unit/API",
        "file": "sanitizer tests",
        "scenario": "Valid TipTap headings/lists/links/images",
        "expected": "Approved formatting and http/https/relative upload URLs remain."
      },
      {
        "id": "XSS-06",
        "layer": "API",
        "file": "test_posts.py",
        "scenario": "Create content becomes empty after sanitize",
        "expected": "422 and no row persisted."
      },
      {
        "id": "XSS-07",
        "layer": "API",
        "file": "test_posts.py",
        "scenario": "Update existing post with unsafe content",
        "expected": "Sanitized safe row or 422; old safe value preserved on failure."
      },
      {
        "id": "XSS-08",
        "layer": "integration",
        "file": "legacy content tests",
        "scenario": "Existing unsafe DB row requested before/after backfill",
        "expected": "Unsafe markup never reaches API response."
      },
      {
        "id": "XSS-09",
        "layer": "frontend unit",
        "file": "sanitizeHtml.test.ts",
        "scenario": "Render malicious API HTML",
        "expected": "DOM sanitizer removes executable markup."
      },
      {
        "id": "XSS-10",
        "layer": "frontend component",
        "file": "AdminModerationPage tests",
        "scenario": "Open pending post preview",
        "expected": "Full content loads, loading/error states work, malicious HTML does not execute."
      },
      {
        "id": "TAG-01",
        "layer": "API",
        "file": "test_tags_categories.py",
        "scenario": "Tag has one approved+published post",
        "expected": "post_count=1."
      },
      {
        "id": "TAG-02",
        "layer": "API",
        "file": "test_tags_categories.py",
        "scenario": "Same tag also has pending, rejected and unpublished posts",
        "expected": "post_count remains 1."
      },
      {
        "id": "TAG-03",
        "layer": "API",
        "file": "test_adversarial_backend.py",
        "scenario": "Multiple tags with filtered counts",
        "expected": "Descending count then name ordering is stable."
      },
      {
        "id": "REP-01",
        "layer": "API",
        "file": "test_reports.py",
        "scenario": "Delete reported post content",
        "expected": "Post rejected+unpublished and all matching open reports resolved in one commit."
      },
      {
        "id": "REP-02",
        "layer": "API",
        "file": "test_reports.py",
        "scenario": "Delete reported comment content",
        "expected": "Comment tombstoned and reports resolved."
      },
      {
        "id": "REP-03",
        "layer": "API",
        "file": "test_reports.py",
        "scenario": "Delete reported user target",
        "expected": "User inactive and reports resolved."
      },
      {
        "id": "REP-04",
        "layer": "API",
        "file": "test_reports.py",
        "scenario": "Two open reports for one target",
        "expected": "One action resolves both with same resolver/time/note."
      },
      {
        "id": "REP-05",
        "layer": "API",
        "file": "test_reports.py",
        "scenario": "Target already absent",
        "expected": "Documented idempotent response; report state remains consistent."
      },
      {
        "id": "REP-06",
        "layer": "API",
        "file": "test_reports.py",
        "scenario": "user/doctor vs moderator/admin content action",
        "expected": "Unauthorized 403; moderator/admin succeeds."
      },
      {
        "id": "FEREP-01",
        "layer": "frontend component/service",
        "file": "AdminReportsPage.test.tsx",
        "scenario": "Click delete content",
        "expected": "Exactly one DELETE /admin/reports/{id}/content; no target DELETE and no second resolve."
      },
      {
        "id": "FEREP-02",
        "layer": "frontend component",
        "file": "ReportActionModal tests",
        "scenario": "Open/resolved/dismissed report states",
        "expected": "Actions only for open; closed status label is accurate."
      },
      {
        "id": "FEQ-01",
        "layer": "frontend build",
        "file": "frontend",
        "scenario": "npm run build",
        "expected": "tsc and Vite build exit 0 with strict unused checks enabled."
      },
      {
        "id": "FEQ-02",
        "layer": "frontend lint",
        "file": "frontend",
        "scenario": "npm run lint",
        "expected": "Exit 0 with zero warnings."
      },
      {
        "id": "FEQ-03",
        "layer": "frontend test",
        "file": "frontend",
        "scenario": "npm test -- --run",
        "expected": "Vitest exits 0 without watch mode."
      },
      {
        "id": "FEQ-04",
        "layer": "frontend component",
        "file": "admin pagination tests",
        "scenario": "0/1/multi-page result sets",
        "expected": "Controls and disabled states match total/page; fetch uses selected page."
      },
      {
        "id": "FEQ-05",
        "layer": "dependency",
        "file": "frontend/package-lock.json",
        "scenario": "Delete node_modules then npm ci",
        "expected": "Install succeeds reproducibly and build/tests pass."
      },
      {
        "id": "FEQ-06",
        "layer": "dependency",
        "file": "frontend/package-lock.json",
        "scenario": "npm audit --omit=dev",
        "expected": "Findings reviewed; no blind force upgrade."
      },
      {
        "id": "UP-01",
        "layer": "API",
        "file": "test_upload.py",
        "scenario": "Valid image <=5MB",
        "expected": "201 relative /uploads URL."
      },
      {
        "id": "UP-02",
        "layer": "API",
        "file": "test_upload.py",
        "scenario": "Spoofed MIME, corrupt image, empty or >5MB",
        "expected": "400; no file persisted."
      },
      {
        "id": "UP-03",
        "layer": "dev proxy",
        "file": "vite.config.ts",
        "scenario": "GET returned upload URL through localhost:3000",
        "expected": "200 and matching image bytes."
      },
      {
        "id": "UP-04",
        "layer": "prod proxy",
        "file": "nginx.conf",
        "scenario": "GET returned upload URL through production frontend",
        "expected": "200 and matching image bytes."
      },
      {
        "id": "UP-05",
        "layer": "prod proxy",
        "file": "nginx.conf",
        "scenario": "Uploaded .jpg/.png path also matches static regex",
        "expected": "^~ /uploads proxy wins; frontend root is not used."
      },
      {
        "id": "OPS-01",
        "layer": "compose",
        "file": "docker-compose.yml",
        "scenario": "docker compose config with no .env",
        "expected": "Dev config succeeds with documented safe defaults."
      },
      {
        "id": "OPS-02",
        "layer": "compose",
        "file": "docker-compose.prod.yml",
        "scenario": "Production config missing required secret/URL/origin",
        "expected": "Config/start fails before app boot with clear message."
      },
      {
        "id": "OPS-03",
        "layer": "container",
        "file": "docker-entrypoint.sh",
        "scenario": "Fresh PostgreSQL volume → compose up",
        "expected": "Alembic reaches head before health endpoint succeeds."
      },
      {
        "id": "OPS-04",
        "layer": "container",
        "file": "docker-entrypoint.sh",
        "scenario": "Restart migrated container",
        "expected": "Migration is idempotent; server becomes healthy."
      },
      {
        "id": "OPS-05",
        "layer": "config",
        "file": "database.py",
        "scenario": "Production settings",
        "expected": "SQL echo is false and secrets are not logged."
      },
      {
        "id": "OPS-06",
        "layer": "admin bootstrap",
        "file": "create_admin.py",
        "scenario": "No admin credentials vs explicit strong credentials",
        "expected": "Missing input fails; explicit input creates one hashed admin; rerun is idempotent."
      },
      {
        "id": "OPS-07",
        "layer": "smoke",
        "file": "README.md",
        "scenario": "Follow documented dev setup from clean checkout",
        "expected": "DB/backend/frontend start; /api/v1/health returns 200."
      },
      {
        "id": "CI-01",
        "layer": "CI",
        "file": ".github/workflows/ci.yml",
        "scenario": "Backend clean job",
        "expected": "Install, compileall and pytest pass."
      },
      {
        "id": "CI-02",
        "layer": "CI",
        "file": ".github/workflows/ci.yml",
        "scenario": "Frontend clean job",
        "expected": "npm ci, lint, build and Vitest pass."
      },
      {
        "id": "CI-03",
        "layer": "CI",
        "file": ".github/workflows/ci.yml",
        "scenario": "PostgreSQL service job",
        "expected": "Alembic upgrade and enum ORM smoke pass."
      },
      {
        "id": "E2E-01",
        "layer": "integration",
        "file": "scripts/smoke-healthcare-forum.ps1",
        "scenario": "Register→login→pending post→approve→public interaction→report/delete→upload retrieval",
        "expected": "Every documented status/response and final moderation state passes."
      },
      {
        "id": "REL-01",
        "layer": "release",
        "file": "README.md",
        "scenario": "Execute backup/migrate/health/smoke/rollback checklist",
        "expected": "Evidence attached; rollback path is executable before production approval."
      }
    ],
    "planned_verification_commands": [
      "python -m compileall -q backend/app backend/tests",
      "python -m pytest -q",
      "npm ci",
      "npm run lint",
      "npm run build",
      "npm test -- --run",
      "docker compose config",
      "docker compose up --build"
    ]
  }
}
~~~

## 12. Assumptions and Open Questions

Confirmed baseline facts are listed in Sections 2–5. The following must be re-checked before implementation:

Assumptions:

- [assumed] PostgreSQL is the production database and SQLite is only a fast test backend; verify deployment history and run one real PostgreSQL migration job.
- [assumed] Public means approved and published; verify the product decision for owner/staff interactions on pending content.
- [assumed] Introducing typed token claims may force existing clients to log in again; coordinate this rollout.
- [assumed] Local mounted uploads remain in scope; object storage/CDN is deferred.
- [assumed] Missing frontend lockfile/ESLint/test/CI artifacts are part of the requested hardening scope.

Open questions:

- [assumed] Was any shared database created with Base.metadata.create_all? Inspect schema and alembic_version before deciding whether 0003_enum_value_alignment.py is required.
- [assumed] Which sanitizer package/version and exact TipTap allowlist should be approved? Validate against representative existing HTML.
- [assumed] What are production JWT_SECRET, DATABASE_URL and allowed CORS origins? Configure secret delivery before enabling production fail-fast.
- [assumed] Is PostgreSQL CI required on every merge or initially an integration/nightly gate?
- [assumed] Should the owner be allowed to comment/react/bookmark pending posts? Recommended default is no community interaction until approved.

Explicitly deferred follow-ups: object storage, rate limiting/abuse throttling, email/notification delivery, persistent comment voting, admin N+1 query optimization, full browser E2E and Recharts dependency migration. These should not be silently folded into this fix.

## 13. Definition of Done

- [ ] get_current_user and optional auth parse UUIDs safely; malformed/expired/inactive/token-kind-invalid requests fail with intentional 401/403 responses.
- [ ] Access/refresh claims, frontend persisted refresh token, single-flight refresh and one-retry 401 behavior are covered by tests; no auth loop remains.
- [ ] Model enum serialization matches lowercase Alembic labels; fresh PostgreSQL migration and any required legacy repair are verified.
- [ ] Post detail no longer raises MissingGreenlet; view counts increment correctly and server timestamps serialize after commit.
- [ ] Feed/detail/comments/reactions/bookmarks/tags obey the approved+published visibility policy and private actor matrix.
- [ ] Server-side sanitizer and frontend render sanitizer remove script/event/unsafe URL payloads while preserving approved TipTap formatting.
- [ ] Hot/tag counts exclude pending, rejected and unpublished posts.
- [ ] Admin report delete uses exactly one atomic endpoint for post/comment/user targets and resolves all open reports consistently; dismissed/resolved UI states are correct.
- [ ] Registration uses /auth/register; admin guard redirects unauthenticated users to login; moderation preview shows safe full content.
- [ ] npm run build, npm run lint, npm test -- --run, python -m pytest -q and python -m compileall -q backend/app backend/tests pass from documented setup.
- [ ] package-lock.json is committed, Docker uses npm ci, dependency audit is reviewed, and no strict compiler rule is disabled.
- [ ] Dev Compose works without an accidental missing .env failure; production Compose fails fast on missing secrets; migrations run before Uvicorn; demo admin credentials are never hardcoded.
- [ ] /uploads/... works through Vite dev and Nginx production proxies.
- [ ] CI/integration smoke verifies register → login → moderation → interaction → report/delete → upload and documents rollback/operational checks.
- [ ] Final review confirms only intended files changed, git diff --check is clean, and no destructive worktree command was used.
- [ ] All G0–G11 group gates are green; every task has code/review/test evidence and no unresolved blocking policy decision.
