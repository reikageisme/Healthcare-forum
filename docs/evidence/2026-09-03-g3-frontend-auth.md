# G3 — Frontend authentication and route guards

Date: 2026-09-03 (Asia/Bangkok).
Implementation base: `363d62b4224d0cdd7bbdcdd26ae5baf8ed4247df`
on `dev/healthcare-forum-hardening`, after the G2 token-lifecycle commit.

Status: **G3 implementation and focused frontend test gate PASS in the local
worktree.** No production deployment, browser E2E run or legacy-session
cutover was performed.

## Implementation

| Task | Current implementation |
| --- | --- |
| T3.1 — typed auth service | `frontend/src/services/authService.ts` owns typed register, login, profile and refresh calls. Token responses are checked before use. `LoginPage` no longer makes direct auth requests. |
| T3.2 — atomic session | `authStore.ts` writes user, access token and refresh token together, rotates both tokens together, and clears all session fields together. Persisted state is versioned; access-only legacy state is retained with a null refresh token, while an interrupted fake-user state is discarded. |
| T3.3 — single-flight refresh | `lib/api.ts` shares one refresh promise across concurrent 401 responses, rotates the returned pair, retries each original request once, excludes only login/register/refresh, and clears/redirects once after failure. A session changed during refresh cannot be overwritten by the stale response. |
| T3.4 — navigation guards | Registration uses `/auth/register` and resolves `/auth/me` before the sole session write. Anonymous admin and edit-post routes redirect to `/login` with a same-origin return path. Moderator/admin and admin-only behavior is preserved. |

Refresh failure redirects to `/login?from=...`, retaining pathname, query and
fragment. External, protocol-relative, backslash and control-character paths
are rejected before React Router navigation.

## Acceptance coverage

| Test ID | Assertions |
| --- | --- |
| FEAUTH-01 | Registration calls the typed `/auth/register` method once, never `/users/`; no fake user is persisted while the real profile is pending. |
| FEAUTH-02 | Complete sessions persist atomically; refresh rotates both tokens; logout clears all fields; old access-only state migrates without inventing a refresh token. |
| FEAUTH-03 | A protected 401 performs one refresh and one successful replay. |
| FEAUTH-04 | Three concurrent 401 responses share exactly one refresh and each replay once. |
| FEAUTH-05 | A shared refresh failure clears and redirects once while preserving the original route. |
| FEAUTH-06 | Login, registration and refresh endpoint 401 responses never enter the refresh interceptor. A replayed 401 cannot loop. |
| FEAUTH-07 | Anonymous `/admin` navigation reaches `/login` with `/admin` as the return path. |
| FEAUTH-08 | Regular users are denied moderation; moderators and admins enter it; moderators remain excluded from admin-only routes. |
| FEAUTH-09 | Anonymous edit navigation redirects before the edit component mounts, so no post/category/tag request starts. |

The six frontend test files contain 23 tests. They use injected Axios adapters
for deterministic refresh concurrency and MemoryRouter components for route
state; no external API or database is contacted.

## Verification

Runtime: Node 22.23.1, npm 10.9.8, frontend Vitest 0.34.6 and TypeScript
5.9.3 from the generated npm lockfile.

| Check | Result |
| --- | --- |
| `cd frontend && npm test` | PASS: 23/23 tests across 6 files. |
| `cd frontend && npm run typecheck` | PASS. |
| `cd frontend && npm run build` | PASS; existing large-chunk warning remains (1,277.72 kB main JS, 371.83 kB gzip). |
| `cd backend && npm test` | PASS: 139/139 across 7 files, including the 52-test G2 dependency. |
| `cd backend && npm run typecheck && npm run build` | PASS. |
| `npm audit --omit=dev` | Reviewed: 29 moderate findings, no high or critical production finding. npm proposes major TipTap/React Router upgrades; no blind force upgrade was applied. |
| `npm audit` | Reviewed: 31 moderate, 1 high (Vite) and 1 critical (Vitest). npm's available fixes are major upgrades owned by the broader G8 dependency gate. |
| `git diff --check` | PASS. |

## Remaining boundaries

The lockfile and test runner are now present because G3 requires executable
frontend regressions. G8 still owns ESLint, broader component/service coverage,
bundle splitting and CI wiring. The dependency findings above also remain a
separate reviewed upgrade because npm's proposed fixes cross major versions.

No live browser was connected to a running frontend/backend pair, so the
manual auth UX clause remains an operational smoke rather than claimed
evidence. Production legacy untyped tokens still require the G2 rollout and
fresh login documented in the G2 evidence.

GitNexus CLI/MCP/index were unavailable. The `gitnexus-work` plan-provenance
helper refused this Windows host because it requires Linux/macOS descriptor
primitives, and the installed WSL distribution had no usable Linux Node
runtime. Requirements were re-read from the committed plan object and checked
against current callers and tests. No graph/PDG impact or graph-backed commit
gate is claimed; G3 changes remain uncommitted for review.
