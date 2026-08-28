# Project: Healthcare Forum Phase 3 (Dashboard & Admin)

## Architecture
Healthcare Forum Phase 3 implements an administrative and moderation subsystem for the FastAPI + React platform. It introduces role-based access control (RBAC), a hybrid content moderation engine, community reporting workflows, real-time analytics with Recharts, and administrative management of users and categories.

```
┌────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                  │
│                                                                        │
│  ┌───────────────────────┐            ┌─────────────────────────────┐  │
│  │   Public Forum Feed   │            │   Admin Portal (/admin/*)   │  │
│  │  (Filtered Approved)  │            │     Guarded by RBAC         │  │
│  └───────────┬───────────┘            └──────────────┬──────────────┘  │
│              │                                       │                 │
│              │ Post & Comment Reports                │ Moderation,     │
│              │ Pending post status badge             │ Stats & Recharts│
│              ▼                                       ▼ Users/Cats      │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │   Zustand Auth Store (JWT, UserRole: user/doctor/mod/admin)       │  │
│  │   adminService, reportService, categoryService, postService      │  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
└─────────────────────────────────────┼──────────────────────────────────┘
                                      │ HTTP / JSON Bearer
┌─────────────────────────────────────┼──────────────────────────────────┐
│                                     ▼                                  │
│                              BACKEND (FastAPI)                         │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │   Dependencies (deps.py): require_role([admin, moderator])       │  │
│  └──────────────────┬───────────────────────────────┬───────────────┘  │
│                     │                               │                  │
│       ┌─────────────▼────────────┐    ┌─────────────▼────────────┐     │
│       │ /api/v1/posts & /reports │    │    /api/v1/admin/*       │     │
│       │ Hybrid moderation logic  │    │  /stats, /posts/pending  │     │
│       │ User report submissions  │    │  /reports, /users, /cats │     │
│       └─────────────┬────────────┘    └─────────────┬────────────┘     │
│                     │                               │                  │
│                     └───────────────┬───────────────┘                  │
│                                     ▼                                  │
│                     SQLAlchemy Async Models & DB                       │
│                     Post(status, rejection_reason)                    │
│                     Report(target_type, status, reason)                │
│                     User(role, is_active), Category                    │
└────────────────────────────────────────────────────────────────────────┘
```

## Feature Inventory

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | RBAC Backend Dependency | `require_role` protecting admin/moderator endpoints | M1 | ORIGINAL_REQUEST §R1 |
| 2 | Post Status & Auto-Approval | `Post.status` (pending/approved/rejected); doctor/mod/admin auto-approved, user pending | M1 | ORIGINAL_REQUEST §R3 |
| 3 | Public Feed Isolation | `GET /api/v1/posts` only returns approved published posts | M1 | ORIGINAL_REQUEST §R3 |
| 4 | Moderation Queue API | List pending posts, approve, and reject with reason | M1 | ORIGINAL_REQUEST §R3 |
| 5 | Report Data Model & User API | Polymorphic `Report` model (`post`, `comment`, `user`) and `POST /api/v1/reports` | M1 | ORIGINAL_REQUEST §R4 |
| 6 | Admin Report Management API | List reports, resolve reports, delete violating content | M1 | ORIGINAL_REQUEST §R4 |
| 7 | Admin Stats & Time-Series API | `/api/v1/admin/stats` with totals and 30-day zero-filled time-series | M1 | ORIGINAL_REQUEST §R2 |
| 8 | Admin User Management API | List/search users, promote role (Doctor/Moderator), ban/deactivate | M1 | ORIGINAL_REQUEST §R5 |
| 9 | Category Management CRUD | Admin/Mod CRUD endpoints for categories (`POST`, `PUT`, `DELETE`) | M1 | ORIGINAL_REQUEST §R5 |
| 10| Alembic Migration | `0002_phase3_admin_moderation.py` adding `Post.status`, `reports` table | M1 | ORIGINAL_REQUEST §Integration |
| 11| Frontend RBAC Guards & Route Protection | `AdminRouteGuard` and `AdminOnlyGuard` protecting `/admin/*` routes | M2 | ORIGINAL_REQUEST §R1 |
| 12| Admin Shell Layout | `AdminLayout`, `AdminSidebar` (role-partitioned), `AdminHeader` | M2 | ORIGINAL_REQUEST §R1 |
| 13| Admin Dashboard with Recharts | Stat Cards + Area/Line and Bar charts for 30-day metrics | M2 | ORIGINAL_REQUEST §R2 |
| 14| Admin Moderation Queue UI | Moderation table with Approve & Reject modal | M2 | ORIGINAL_REQUEST §R3 |
| 15| Admin Reports UI | Report list with resolve & delete content actions | M2 | ORIGINAL_REQUEST §R4 |
| 16| Admin User Management UI | Search, filter, promote role, ban/activate toggle | M2 | ORIGINAL_REQUEST §R5 |
| 17| Admin Category Management UI | Categories table with Add, Edit, Delete modals | M2 | ORIGINAL_REQUEST §R5 |
| 18| Client Post Status Badge & Banner | "Đang chờ duyệt" badge on FeedCard and info banner on PostDetail | M3 | ORIGINAL_REQUEST §R3 |
| 19| Client "Báo cáo vi phạm" Trigger & Modal | Report violation button on posts & comments opening `ReportModal` | M3 | ORIGINAL_REQUEST §R4 |
| 20| Navigation Link to Admin | Header dropdown entry to `/admin` for Moderator & Admin | M3 | ORIGINAL_REQUEST §R1 |
| 21| Full Integration & Multi-tier Verification | Reviewers, Challengers, and Forensic Auditor verification | M4 | ORIGINAL_REQUEST §Acceptance Criteria |

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Backend Admin API, Moderation, Reports, Stats, Migrations & Tests | R1 Backend, R2 Backend, R3 Backend, R4 Backend, R5 Backend, DB Migration, Pytest suite | none | DONE |
| 2 | Frontend Admin Portal & Recharts Dashboard | R1 Frontend, R2 Frontend, R3 Admin UI, R4 Admin UI, R5 Admin UI, `recharts` package | M1 interface contracts | DONE |
| 3 | Client UI Integration & Interaction Feedback | R3 Client UI, R4 Client UI, Header dropdown admin link, TypeScript check | M1, M2 | DONE |
| 4 | Verification, E2E Testing, Adversarial Hardening & Forensic Audit | Reviewers APPROVE, Challengers APPROVE, Auditor CLEAN, Acceptance Criteria pass | M1, M2, M3 | IN_PROGRESS |

## Interface Contracts

### 1. `/api/v1/admin/stats`
- **Request**: `GET /api/v1/admin/stats?days=30` (Header: `Authorization: Bearer <token>`, role: `admin` or `moderator`)
- **Response**:
```json
{
  "overview": {
    "total_users": 120,
    "total_posts": 45,
    "total_comments": 210,
    "total_pending_posts": 4,
    "total_open_reports": 2,
    "total_doctors": 15
  },
  "time_series": [
    { "date": "2026-07-30", "new_users": 3, "new_posts": 1, "new_comments": 10 },
    ...
  ]
}
```

### 2. `/api/v1/admin/posts` (Moderation Queue)
- **List**: `GET /api/v1/admin/posts?status=pending&page=1&limit=20` $\rightarrow$ `{ items: PostSummaryResponse[], total: number, page: number, limit: number, total_pages: number }`
- **Update Status**: `PUT /api/v1/admin/posts/{id}/status` Body: `{ "status": "approved" | "rejected", "reason": "optional rejection reason" }` $\rightarrow$ `PostSummaryResponse`

### 3. `/api/v1/reports` & `/api/v1/admin/reports`
- **Create**: `POST /api/v1/reports` Body: `{ "target_type": "post" | "comment" | "user", "target_id": "UUID", "report_type": "spam" | "misinformation" | "harassment" | "other", "reason": "string", "details": "string" }` $\rightarrow$ `201 Created`
- **List (Admin/Mod)**: `GET /api/v1/admin/reports?status=open&page=1&limit=20` $\rightarrow$ `{ items: ReportDetailResponse[], total: number, page: number, limit: number }`
- **Resolve (Admin/Mod)**: `PUT /api/v1/admin/reports/{id}` Body: `{ "status": "resolved" | "dismissed", "resolution_notes": "string" }` $\rightarrow$ `ReportDetailResponse`
- **Delete Content (Admin/Mod)**: `DELETE /api/v1/admin/reports/{id}/content` $\rightarrow$ `200 OK`

### 4. `/api/v1/admin/users`
- **List**: `GET /api/v1/admin/users?search=&role=&is_active=&page=1&limit=20` $\rightarrow$ `{ items: UserResponse[], total: number, page: number, limit: number }`
- **Update Role (Admin Only)**: `PUT /api/v1/admin/users/{id}/role` Body: `{ "role": "user" | "doctor" | "moderator" | "admin", "specialty": "string" }` $\rightarrow$ `UserResponse`
- **Update Status (Admin Only)**: `PUT /api/v1/admin/users/{id}/status` Body: `{ "is_active": boolean }` $\rightarrow$ `UserResponse`

### 5. `/api/v1/categories`
- **Create (Admin/Mod)**: `POST /api/v1/categories` Body: `{ "name": "string", "slug": "string", "icon": "string", "description": "string" }`
- **Update (Admin/Mod)**: `PUT /api/v1/categories/{id}` Body: `{ "name": "string", "slug": "string", "icon": "string", "description": "string" }`
- **Delete (Admin Only)**: `DELETE /api/v1/categories/{id}` $\rightarrow$ `204 No Content` (Sets associated posts `category_id = NULL`)

## Code Layout

```
backend/
├── alembic/versions/0002_phase3_admin_moderation.py
├── app/
│   ├── api/
│   │   ├── deps.py                       # require_role, require_admin_or_moderator, require_admin_only
│   │   └── v1/
│   │       ├── admin.py                  # /admin/stats, /admin/posts, /admin/reports, /admin/users
│   │       ├── reports.py                # POST /reports
│   │       ├── posts.py                  # Hybrid auto-approval & status filter
│   │       └── categories.py             # CRUD PUT/DELETE
│   ├── models/
│   │   ├── post.py                       # PostStatus enum, status & rejection_reason
│   │   ├── report.py                     # Report model, ReportStatus, ReportTargetType
│   │   └── __init__.py
│   └── schemas/
│       ├── post.py                       # status exposed in response, PostModerationUpdate
│       ├── report.py                     # ReportCreate, ReportUpdate, ReportResponse
│       ├── admin_stats.py                # AdminStatsResponse, DailyDataPoint
│       ├── user.py                       # UserRoleUpdate, UserStatusUpdate, UserListPage
│       └── category.py                   # CategoryUpdate
└── tests/
    ├── test_moderation.py                # Hybrid moderation & queue tests
    ├── test_reports.py                   # Report creation, resolution, deletion tests
    ├── test_admin_stats.py               # Stats & 30-day time series tests
    ├── test_admin_users.py               # User search, promotion, ban tests
    └── test_admin_categories.py          # Category CRUD tests

frontend/
├── package.json                          # Added recharts
├── src/
│   ├── types/index.ts                    # PostStatus, AdminStats, Report, UserAdmin inputs
│   ├── services/
│   │   ├── adminService.ts               # Admin API client
│   │   └── reportService.ts              # Report submission API client
│   ├── hooks/useAuth.ts                  # canModerate, isAdmin, isModerator helpers
│   ├── layouts/
│   │   └── AdminLayout.tsx               # Admin container shell
│   ├── components/
│   │   ├── Header/Header.tsx             # Added "Trang quản trị" link for staff
│   │   ├── Feed/FeedCard.tsx             # Pending badge + Report trigger
│   │   ├── comments/CommentItem.tsx      # Report trigger
│   │   ├── common/
│   │   │   └── ReportModal.tsx           # User report popup dialog
│   │   └── admin/
│   │       ├── AdminRouteGuard.tsx       # RBAC route protection
│   │       ├── AdminOnlyGuard.tsx        # Admin-only route guard
│   │       ├── AdminSidebar.tsx          # Role-partitioned navigation
│   │       ├── AdminHeader.tsx           # Breadcrumbs, staff badge
│   │       ├── StatCard.tsx              # Metric card with trend
│   │       ├── UserGrowthChart.tsx       # Recharts AreaChart
│   │       ├── PostActivityChart.tsx     # Recharts BarChart
│   │       ├── RejectModal.tsx           # Moderation reject prompt
│   │       ├── ReportActionModal.tsx     # Report resolve / action modal
│   │       ├── EditUserModal.tsx         # User role/status modal
│   │       └── CategoryModal.tsx         # Category add/edit modal
│   ├── pages/
│   │   ├── PostDetailPage.tsx            # Pending info banner + Report trigger
│   │   └── admin/
│   │       ├── AdminDashboardPage.tsx    # Stats + Recharts charts
│   │       ├── AdminModerationPage.tsx   # Pending queue table & actions
│   │       ├── AdminReportsPage.tsx      # Reports list & actions
│   │       ├── AdminUsersPage.tsx        # User management table & actions
│   │       └── AdminCategoriesPage.tsx   # Category management table & actions
│   └── App.tsx                           # /admin/* nested routing configuration
```
