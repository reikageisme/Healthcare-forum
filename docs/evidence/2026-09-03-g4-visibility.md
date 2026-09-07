# G4 — Unified post visibility and interaction policy

Date: 2026-09-03 (Asia/Bangkok).
Implementation base: `363d62b4224d0cdd7bbdcdd26ae5baf8ed4247df`
on `dev/healthcare-forum-hardening`, preserving the existing local G3 changes.

Status: **G4 implementation and API test gate PASS in the local worktree.**
No production database, deployment, migration or rollout was performed.

## Policy used for this implementation

The user requested G4 and then directed work to continue after the proposed
default was stated. The implementation follows the historical plan's
recommended policy below. This does not mark the broader POLICY-01 choices
or production rollout as approved.

| Actor | Approved + published read | Pending/rejected/unpublished read | Public community mutation | Non-public community mutation |
| --- | --- | --- | --- | --- |
| Anonymous | 200 | 404 | 401 | 401 |
| Unrelated authenticated user | 200 | 404 | Existing success response | 404 |
| Post owner | 200 | 200 | Existing success response | 409, no mutation |
| Moderator | 200 | 200 | Existing success response | 409, no mutation |
| Admin | 200 | 200 | Existing success response | 409, no mutation |

Community mutations mean new comments/replies and reaction/bookmark toggles.
Post editorial actions and staff comment moderation retain their original
ownership/role checks after the shared read check. A comment's author alone
does not gain access to a hidden parent post. Doctors are not staff for
private reads. Optional authentication treats invalid, refresh-kind and
inactive credentials as anonymous, using the G2 middleware unchanged.

## Implementation and acceptance coverage

| Task | Implementation and tests |
| --- | --- |
| T4.1 | `src/lib/postAccess.ts` separates public state, read eligibility, interaction eligibility and list predicates. `findPostOr404` now requires a viewer and explicit `read`/`interact` intent. VIS-01/08 verify generic 404 bodies without data or counter side effects. |
| T4.2 | Post list/detail use the shared policy. Ordinary feeds are public; owner `author_id` queries and valid explicit staff status filters include private/unpublished rows. VIS-01/07 cover status filters and keyset ordering; the existing two-read view-count regression remains green. |
| T4.3 | Comment reads check access before loading the tree; new comments/replies check interaction eligibility before body validation or writes. VIS-02/04 cover both identifiers, nested replies, cross-post parent validation and unchanged counters on denial. Comment edit/delete also gate parent visibility and return the same body for hidden and absent comments. |
| T4.4 | Reaction counts use read access; toggles use interaction access. VIS-03/05 cover new, removal and switch attempts with no mutation of hidden reactions or helpful_count. Existing public tri-state regression coverage is unchanged. |
| T4.5 | Bookmark toggles require a public post; the feed filters both status and publication in SQL before pagination, regardless of role. VIS-06 covers reject/unpublish transitions, hidden-row retention, republish/removal, deletion cascade and bookmark-time cursors. |
| T4.6 | `tests/visibility.test.ts` adds 195 tests, including the five-actor/four-state matrix for UUID and slug lookups, optional-auth failures, default/private list filters, anonymity and unchanged editorial/moderation permissions. |

Hidden bookmarks are retained, omitted from the feed and not mutated by a
failed toggle. On republishing, the retained bookmark reappears and one
toggle removes it. No new hidden-bookmark cleanup endpoint was added.

The source-derived caller check accounted for the five original
`findPostOr404` call sites in comments/reactions/bookmarks, the two joined
post detail/update lookups, and the separate post/comment editorial routes.
It also checked the adjacent tag/category/stats/report paths for scope;
their separate aggregation/report work was not folded into G4.

## Verification

Runtime: Node 22.23.1, npm 10.9.8, backend Vitest 2.1.9 and installed
TypeScript. API tests use isolated in-memory PGlite databases via the real
Hono router and migration bootstrap; no external database is contacted.

| Check | Result |
| --- | --- |
| Existing backend `npm test` before G4 | PASS: 139/139 across 7 files. |
| Initial G4 matrix against the unchanged backend | 77 failures, 97 passes (174 tests): hidden reads/mutations, unpublished private lists, bookmark filtering and editorial existence leaks were reproduced. |
| Hidden/missing comment error-body probe after the first policy pass | Reproduced two failures: hidden comments returned `Post not found` while absent comments returned `Comment not found`. Both now have the comment-specific 404 body. |
| `cd backend && npm test -- tests/visibility.test.ts` | PASS: 195/195. |
| `cd backend && npm test` | PASS: 334/334 across 8 files (139 existing plus 195 G4). |
| `cd backend && npm run typecheck` | PASS. |
| `cd backend && npm run build` | PASS. |
| Explicit strict typecheck of `tests/visibility.test.ts` and its imports | PASS after aligning the shared request helper with Hono's synchronous-or-async return type. |
| `cd frontend && npm test -- --run` | PASS: the existing G3 suite remains 23/23. |
| `cd frontend && npm run build` | PASS; unchanged large-chunk warning, 1,277.72 kB main JS / 371.83 kB gzip. |
| `git diff --check` | PASS. |

The explicit test typecheck used:

```text
node node_modules/typescript/bin/tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler --esModuleInterop --skipLibCheck --strict --noUncheckedIndexedAccess --types node tests/visibility.test.ts
```

The existing `tests/setup.ts` promised `Promise<Response>` but directly
returned Hono's `Response | Promise<Response>`, which the normal source-only
typecheck excludes. Its one-line `Promise.resolve` wrapper makes that
existing contract accurate. No test assertion was removed or weakened.

## Boundaries and remaining gates

No database schema, migration, backend auth contract, dependency or frontend
source change was needed. The historical generated plan and G3 source/tests
remain unchanged. G4 includes read gates on current editorial endpoints so
they cannot bypass privacy, but does not expand their ownership permissions.

Tag aggregation is G6; report workflow changes are G7; frontend lint/broader
coverage/CI and deployment/rollback gates remain separate. This is an API
implementation gate, not a live PostgreSQL-server, browser E2E or release-ready
claim. The broader POLICY-01 deferral remains recorded.

GitNexus graph tools/index were unavailable, and the `gitnexus-work`
descriptor-anchored plan reader refused the Windows host. Historical
requirements were read from the committed plan object and rechecked against
current source/callers. No graph/PDG impact, descriptor provenance or
graph-backed commit gate is claimed. G4 changes remain uncommitted for review.
