from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
from uuid import UUID
import math

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, or_, and_, desc
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.api.deps import require_admin_or_moderator, require_admin_only
from app.models.user import User, UserRole
from app.models.post import Post, PostStatus
from app.models.comment import Comment
from app.models.report import Report, ReportStatus, ReportTargetType
from app.models.category import Category
from app.schemas.user import UserResponse, UserRoleUpdate, UserStatusUpdate, AdminUserUpdate, UserListPage
from app.schemas.post import (
    PostSummaryResponse,
    PostModerationUpdate,
    PostRejectRequest,
    PostListPage,
)
from app.schemas.report import ReportResponse, ReportUpdateStatus, ReportListPage
from app.schemas.admin_stats import (
    AdminStatsResponse,
    AdminStatsOverview,
    DailyDataPoint,
)
from app.schemas.category import CategoryResponse
from app.schemas.tag import TagResponse

router = APIRouter(prefix="/admin", tags=["admin"])


# ==============================================================================
# 1. DASHBOARD & ANALYTICS
# ==============================================================================

@router.get("/stats", response_model=AdminStatsResponse)
async def get_admin_stats(
    days: int = Query(30, ge=1, le=90, description="Number of past days for time series aggregation"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_moderator),
):
    # 1. Summary totals
    total_users_res = await db.execute(select(func.count(User.id)))
    total_users = total_users_res.scalar() or 0

    total_posts_res = await db.execute(
        select(func.count(Post.id)).filter(Post.status == PostStatus.APPROVED)
    )
    total_posts = total_posts_res.scalar() or 0

    total_comments_res = await db.execute(
        select(func.count(Comment.id)).filter(Comment.is_deleted == False)
    )
    total_comments = total_comments_res.scalar() or 0

    total_pending_res = await db.execute(
        select(func.count(Post.id)).filter(Post.status == PostStatus.PENDING)
    )
    total_pending_posts = total_pending_res.scalar() or 0

    total_reports_res = await db.execute(
        select(func.count(Report.id)).filter(Report.status == ReportStatus.OPEN)
    )
    total_open_reports = total_reports_res.scalar() or 0

    total_categories_res = await db.execute(select(func.count(Category.id)))
    total_categories = total_categories_res.scalar() or 0

    total_doctors_res = await db.execute(
        select(func.count(User.id)).filter(User.role == UserRole.doctor)
    )
    total_doctors = total_doctors_res.scalar() or 0

    overview = AdminStatsOverview(
        total_users=total_users,
        total_posts=total_posts,
        total_comments=total_comments,
        total_pending_posts=total_pending_posts,
        total_open_reports=total_open_reports,
        total_categories=total_categories,
        total_doctors=total_doctors,
    )

    # 2. Daily time series with zero-filling
    now = datetime.now(timezone.utc)
    # Generate continuous date list from (today - (days - 1)) to today
    date_list = [(now.date() - timedelta(days=i)).isoformat() for i in range(days - 1, -1, -1)]
    cutoff_date = datetime.combine(now.date() - timedelta(days=days - 1), datetime.min.time()).replace(tzinfo=timezone.utc)

    # Query daily counts
    user_daily_stmt = (
        select(func.date(User.created_at).label("day"), func.count(User.id).label("count"))
        .filter(User.created_at >= cutoff_date)
        .group_by(func.date(User.created_at))
    )
    user_daily_res = await db.execute(user_daily_stmt)
    user_daily_map = {str(row[0]): row[1] for row in user_daily_res.all()}

    post_daily_stmt = (
        select(func.date(Post.created_at).label("day"), func.count(Post.id).label("count"))
        .filter(Post.created_at >= cutoff_date)
        .group_by(func.date(Post.created_at))
    )
    post_daily_res = await db.execute(post_daily_stmt)
    post_daily_map = {str(row[0]): row[1] for row in post_daily_res.all()}

    comment_daily_stmt = (
        select(func.date(Comment.created_at).label("day"), func.count(Comment.id).label("count"))
        .filter(Comment.created_at >= cutoff_date)
        .group_by(func.date(Comment.created_at))
    )
    comment_daily_res = await db.execute(comment_daily_stmt)
    comment_daily_map = {str(row[0]): row[1] for row in comment_daily_res.all()}

    time_series = []
    for d_str in date_list:
        time_series.append(
            DailyDataPoint(
                date=d_str,
                new_users=user_daily_map.get(d_str, 0),
                new_posts=post_daily_map.get(d_str, 0),
                new_comments=comment_daily_map.get(d_str, 0),
            )
        )

    return AdminStatsResponse(
        overview=overview,
        totals=overview,
        time_series=time_series,
    )


# ==============================================================================
# 2. MODERATION QUEUE & POST MANAGEMENT
# ==============================================================================

@router.get("/posts", response_model=PostListPage)
@router.get("/moderation/posts", response_model=PostListPage)
async def list_admin_posts(
    status: Optional[str] = Query("pending", description="Filter by post status: pending, approved, rejected, all"),
    category_id: Optional[UUID] = Query(None, description="Filter by category ID"),
    search: Optional[str] = Query(None, description="Search keyword in title/content"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_moderator),
):
    stmt = (
        select(Post)
        .options(
            selectinload(Post.author),
            selectinload(Post.category),
            selectinload(Post.tags),
        )
    )

    if status and status.lower() != "all":
        try:
            st_enum = PostStatus(status.lower())
            stmt = stmt.filter(Post.status == st_enum)
        except ValueError:
            pass

    if category_id:
        stmt = stmt.filter(Post.category_id == category_id)

    if search and search.strip():
        term = f"%{search.strip()}%"
        stmt = stmt.filter(or_(Post.title.ilike(term), Post.content.ilike(term)))

    # Count total matching posts
    count_stmt = select(func.count(Post.id))
    if status and status.lower() != "all":
        try:
            st_enum = PostStatus(status.lower())
            count_stmt = count_stmt.filter(Post.status == st_enum)
        except ValueError:
            pass
    if category_id:
        count_stmt = count_stmt.filter(Post.category_id == category_id)
    if search and search.strip():
        term = f"%{search.strip()}%"
        count_stmt = count_stmt.filter(or_(Post.title.ilike(term), Post.content.ilike(term)))

    total_res = await db.execute(count_stmt)
    total = total_res.scalar() or 0
    total_pages = max(1, math.ceil(total / limit))

    # Paginate
    offset = (page - 1) * limit
    stmt = stmt.order_by(Post.created_at.desc()).offset(offset).limit(limit)

    result = await db.execute(stmt)
    posts = result.scalars().all()

    items = [
        PostSummaryResponse(
            id=p.id,
            title=p.title,
            slug=p.slug,
            excerpt=p.excerpt,
            thumbnail=p.thumbnail,
            post_type=p.post_type,
            status=p.status,
            rejection_reason=p.rejection_reason,
            view_count=p.view_count,
            helpful_count=p.helpful_count,
            comment_count=p.comment_count,
            is_published=p.is_published,
            created_at=p.created_at,
            updated_at=p.updated_at,
            author=UserResponse.model_validate(p.author),
            category=CategoryResponse.model_validate(p.category) if p.category else None,
            tags=[TagResponse.model_validate(t) for t in p.tags],
            user_reaction=None,
            is_bookmarked=False,
        )
        for p in posts
    ]

    return PostListPage(
        items=items,
        total=total,
        page=page,
        limit=limit,
        total_pages=total_pages,
        pages=total_pages,
    )


@router.put("/posts/{post_id}/status")
async def update_post_status(
    post_id: UUID,
    status_in: PostModerationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_moderator),
):
    stmt = (
        select(Post)
        .options(
            selectinload(Post.author),
            selectinload(Post.category),
            selectinload(Post.tags),
        )
        .filter(Post.id == post_id)
    )
    result = await db.execute(stmt)
    post = result.scalars().first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    post.status = status_in.status
    if status_in.status == PostStatus.APPROVED:
        post.rejection_reason = None
    else:
        post.rejection_reason = status_in.rejection_reason or status_in.reason

    await db.commit()
    await db.refresh(post)

    return {
        "success": True,
        "message": f"Post status updated to {post.status.value}",
        "status": post.status.value,
        "rejection_reason": post.rejection_reason,
        "post": PostSummaryResponse(
            id=post.id,
            title=post.title,
            slug=post.slug,
            excerpt=post.excerpt,
            thumbnail=post.thumbnail,
            post_type=post.post_type,
            status=post.status,
            rejection_reason=post.rejection_reason,
            view_count=post.view_count,
            helpful_count=post.helpful_count,
            comment_count=post.comment_count,
            is_published=post.is_published,
            created_at=post.created_at,
            updated_at=post.updated_at,
            author=UserResponse.model_validate(post.author),
            category=CategoryResponse.model_validate(post.category) if post.category else None,
            tags=[TagResponse.model_validate(t) for t in post.tags],
        ),
    }


@router.post("/posts/{post_id}/approve")
@router.post("/moderation/posts/{post_id}/approve")
async def approve_post(
    post_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_moderator),
):
    stmt = (
        select(Post)
        .options(
            selectinload(Post.author),
            selectinload(Post.category),
            selectinload(Post.tags),
        )
        .filter(Post.id == post_id)
    )
    result = await db.execute(stmt)
    post = result.scalars().first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    post.status = PostStatus.APPROVED
    post.rejection_reason = None

    await db.commit()
    await db.refresh(post)

    return {
        "success": True,
        "message": "Post approved successfully",
        "status": "approved",
        "post": PostSummaryResponse(
            id=post.id,
            title=post.title,
            slug=post.slug,
            excerpt=post.excerpt,
            thumbnail=post.thumbnail,
            post_type=post.post_type,
            status=post.status,
            rejection_reason=post.rejection_reason,
            view_count=post.view_count,
            helpful_count=post.helpful_count,
            comment_count=post.comment_count,
            is_published=post.is_published,
            created_at=post.created_at,
            updated_at=post.updated_at,
            author=UserResponse.model_validate(post.author),
            category=CategoryResponse.model_validate(post.category) if post.category else None,
            tags=[TagResponse.model_validate(t) for t in post.tags],
        ),
    }


@router.post("/posts/{post_id}/reject")
@router.post("/moderation/posts/{post_id}/reject")
async def reject_post(
    post_id: UUID,
    reject_in: Optional[PostRejectRequest] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_moderator),
):
    stmt = (
        select(Post)
        .options(
            selectinload(Post.author),
            selectinload(Post.category),
            selectinload(Post.tags),
        )
        .filter(Post.id == post_id)
    )
    result = await db.execute(stmt)
    post = result.scalars().first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    reason = reject_in.reason if reject_in else None
    post.status = PostStatus.REJECTED
    post.rejection_reason = reason

    await db.commit()
    await db.refresh(post)

    return {
        "success": True,
        "message": "Post rejected",
        "status": "rejected",
        "rejection_reason": reason,
        "post": PostSummaryResponse(
            id=post.id,
            title=post.title,
            slug=post.slug,
            excerpt=post.excerpt,
            thumbnail=post.thumbnail,
            post_type=post.post_type,
            status=post.status,
            rejection_reason=post.rejection_reason,
            view_count=post.view_count,
            helpful_count=post.helpful_count,
            comment_count=post.comment_count,
            is_published=post.is_published,
            created_at=post.created_at,
            updated_at=post.updated_at,
            author=UserResponse.model_validate(post.author),
            category=CategoryResponse.model_validate(post.category) if post.category else None,
            tags=[TagResponse.model_validate(t) for t in post.tags],
        ),
    }


# ==============================================================================
# 3. REPORT MANAGEMENT
# ==============================================================================

async def enrich_report_response(report: Report, db: AsyncSession) -> ReportResponse:
    target_title = None
    target_author_name = None

    if report.target_type == ReportTargetType.POST:
        post_res = await db.execute(
            select(Post).options(selectinload(Post.author)).filter(Post.id == report.target_id)
        )
        p = post_res.scalars().first()
        if p:
            target_title = p.title
            target_author_name = p.author.username if p.author else None
        else:
            target_title = "[Deleted Post]"
    elif report.target_type == ReportTargetType.COMMENT:
        com_res = await db.execute(
            select(Comment).options(selectinload(Comment.author)).filter(Comment.id == report.target_id)
        )
        c = com_res.scalars().first()
        if c:
            target_title = c.content[:60]
            target_author_name = c.author.username if c.author else None
        else:
            target_title = "[Deleted Comment]"
    elif report.target_type == ReportTargetType.USER:
        user_res = await db.execute(select(User).filter(User.id == report.target_id))
        u = user_res.scalars().first()
        if u:
            target_title = u.username
            target_author_name = u.username
        else:
            target_title = "[Deleted User]"

    return ReportResponse(
        id=report.id,
        reporter_id=report.reporter_id,
        target_type=report.target_type,
        target_id=report.target_id,
        report_type=report.report_type,
        reason=report.reason,
        details=report.details,
        status=report.status,
        resolution_notes=report.resolution_notes,
        resolved_by=report.resolved_by,
        resolved_at=report.resolved_at,
        created_at=report.created_at,
        updated_at=report.updated_at,
        reporter=UserResponse.model_validate(report.reporter) if report.reporter else None,
        resolver=UserResponse.model_validate(report.resolver) if report.resolver else None,
        target_title=target_title,
        target_author_name=target_author_name,
    )


@router.get("/reports", response_model=ReportListPage)
async def list_reports(
    status: Optional[str] = Query(None, description="Filter by status: open, resolved, dismissed, all"),
    target_type: Optional[str] = Query(None, description="Filter by target type: post, comment, user"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_moderator),
):
    stmt = select(Report).options(
        selectinload(Report.reporter),
        selectinload(Report.resolver),
    )

    if status and status.lower() != "all":
        try:
            st_enum = ReportStatus(status.lower())
            stmt = stmt.filter(Report.status == st_enum)
        except ValueError:
            pass

    if target_type:
        try:
            tt_enum = ReportTargetType(target_type.lower())
            stmt = stmt.filter(Report.target_type == tt_enum)
        except ValueError:
            pass

    # Total count
    count_stmt = select(func.count(Report.id))
    if status and status.lower() != "all":
        try:
            st_enum = ReportStatus(status.lower())
            count_stmt = count_stmt.filter(Report.status == st_enum)
        except ValueError:
            pass
    if target_type:
        try:
            tt_enum = ReportTargetType(target_type.lower())
            count_stmt = count_stmt.filter(Report.target_type == tt_enum)
        except ValueError:
            pass

    total_res = await db.execute(count_stmt)
    total = total_res.scalar() or 0
    total_pages = max(1, math.ceil(total / limit))

    # Paginate
    offset = (page - 1) * limit
    stmt = stmt.order_by(Report.created_at.desc()).offset(offset).limit(limit)

    result = await db.execute(stmt)
    reports = result.scalars().all()

    items = []
    for r in reports:
        item = await enrich_report_response(r, db)
        items.append(item)

    return ReportListPage(
        items=items,
        total=total,
        page=page,
        limit=limit,
        total_pages=total_pages,
        pages=total_pages,
    )


@router.put("/reports/{report_id}", response_model=ReportResponse)
@router.patch("/reports/{report_id}", response_model=ReportResponse)
async def update_report_status(
    report_id: UUID,
    report_in: ReportUpdateStatus,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_moderator),
):
    stmt = select(Report).options(
        selectinload(Report.reporter),
        selectinload(Report.resolver),
    ).filter(Report.id == report_id)
    result = await db.execute(stmt)
    report = result.scalars().first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    report.status = report_in.status
    if report_in.resolution_notes is not None:
        report.resolution_notes = report_in.resolution_notes
    report.resolved_by = current_user.id
    report.resolved_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(report)

    return await enrich_report_response(report, db)


@router.delete("/reports/{report_id}/content")
async def delete_reported_content(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_moderator),
):
    stmt = select(Report).filter(Report.id == report_id)
    result = await db.execute(stmt)
    report = result.scalars().first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    target_type = report.target_type
    target_id = report.target_id

    # 1. Action on target content
    if target_type == ReportTargetType.POST:
        p_res = await db.execute(select(Post).filter(Post.id == target_id))
        p = p_res.scalars().first()
        if p:
            p.status = PostStatus.REJECTED
            p.is_published = False
            p.rejection_reason = "Content removed by moderator"
    elif target_type == ReportTargetType.COMMENT:
        c_res = await db.execute(select(Comment).filter(Comment.id == target_id))
        c = c_res.scalars().first()
        if c:
            c.is_deleted = True
            c.content = "[Nội dung đã bị xóa do vi phạm tiêu chuẩn cộng đồng]"
    elif target_type == ReportTargetType.USER:
        u_res = await db.execute(select(User).filter(User.id == target_id))
        u = u_res.scalars().first()
        if u:
            u.is_active = False

    # 2. Resolve all open reports for this target
    open_reports_stmt = select(Report).filter(
        Report.target_type == target_type,
        Report.target_id == target_id,
        Report.status == ReportStatus.OPEN,
    )
    open_reports_res = await db.execute(open_reports_stmt)
    for r in open_reports_res.scalars().all():
        r.status = ReportStatus.RESOLVED
        r.resolution_notes = "Content removed by moderator"
        r.resolved_by = current_user.id
        r.resolved_at = datetime.now(timezone.utc)

    # Mark current report as resolved if not already
    report.status = ReportStatus.RESOLVED
    report.resolution_notes = "Content removed by moderator"
    report.resolved_by = current_user.id
    report.resolved_at = datetime.now(timezone.utc)

    await db.commit()

    return {
        "success": True,
        "message": "Reported content removed and report resolved",
        "deleted_type": target_type.value,
        "target_id": str(target_id),
    }


@router.delete("/reports/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_report(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_moderator),
):
    stmt = select(Report).filter(Report.id == report_id)
    result = await db.execute(stmt)
    report = result.scalars().first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    await db.delete(report)
    await db.commit()


# ==============================================================================
# 4. USER MANAGEMENT
# ==============================================================================

@router.get("/users", response_model=UserListPage)
async def list_admin_users(
    search: Optional[str] = Query(None, description="Search keyword in username, email, or full_name"),
    role: Optional[str] = Query(None, description="Filter by user role"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    sort_by: str = Query("newest", description="Sorting option: newest, oldest, username"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_moderator),
):
    # Main query
    stmt = select(User)

    if search and search.strip():
        term = f"%{search.strip()}%"
        stmt = stmt.filter(
            or_(
                User.username.ilike(term),
                User.email.ilike(term),
                User.full_name.ilike(term),
            )
        )

    if role:
        try:
            role_enum = UserRole(role.lower())
            stmt = stmt.filter(User.role == role_enum)
        except ValueError:
            pass

    if is_active is not None:
        stmt = stmt.filter(User.is_active == is_active)

    # Count
    count_stmt = select(func.count(User.id))
    if search and search.strip():
        term = f"%{search.strip()}%"
        count_stmt = count_stmt.filter(
            or_(
                User.username.ilike(term),
                User.email.ilike(term),
                User.full_name.ilike(term),
            )
        )
    if role:
        try:
            role_enum = UserRole(role.lower())
            count_stmt = count_stmt.filter(User.role == role_enum)
        except ValueError:
            pass
    if is_active is not None:
        count_stmt = count_stmt.filter(User.is_active == is_active)

    total_res = await db.execute(count_stmt)
    total = total_res.scalar() or 0
    total_pages = max(1, math.ceil(total / limit))

    # Sort
    if sort_by == "oldest":
        stmt = stmt.order_by(User.created_at.asc())
    elif sort_by == "username":
        stmt = stmt.order_by(User.username.asc())
    else:
        stmt = stmt.order_by(User.created_at.desc())

    offset = (page - 1) * limit
    stmt = stmt.offset(offset).limit(limit)

    result = await db.execute(stmt)
    users = result.scalars().all()

    # Query counts for users
    items = []
    for u in users:
        p_count_res = await db.execute(
            select(func.count(Post.id)).filter(Post.author_id == u.id)
        )
        c_count_res = await db.execute(
            select(func.count(Comment.id)).filter(Comment.author_id == u.id)
        )
        post_count = p_count_res.scalar() or 0
        comment_count = c_count_res.scalar() or 0

        user_resp = UserResponse(
            id=u.id,
            email=u.email,
            username=u.username,
            full_name=u.full_name,
            avatar_url=u.avatar_url,
            specialty=u.specialty,
            bio=u.bio,
            role=u.role,
            is_active=u.is_active,
            created_at=u.created_at,
            post_count=post_count,
            comment_count=comment_count,
        )
        items.append(user_resp)

    return UserListPage(
        items=items,
        total=total,
        page=page,
        limit=limit,
        total_pages=total_pages,
        pages=total_pages,
    )


@router.put("/users/{user_id}/role", response_model=UserResponse)
async def update_user_role(
    user_id: UUID,
    role_in: UserRoleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_only),
):
    stmt = select(User).filter(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent admin self-demotion
    if current_user.id == user.id and role_in.role != UserRole.admin:
        raise HTTPException(status_code=400, detail="Cannot modify your own administrative role")

    user.role = role_in.role
    await db.commit()
    await db.refresh(user)

    return UserResponse.model_validate(user)


@router.put("/users/{user_id}/status", response_model=UserResponse)
async def update_user_status(
    user_id: UUID,
    status_in: UserStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_only),
):
    stmt = select(User).filter(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent admin self-deactivation
    if current_user.id == user.id and not status_in.is_active:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account")

    user.is_active = status_in.is_active
    await db.commit()
    await db.refresh(user)

    return UserResponse.model_validate(user)


@router.patch("/users/{user_id}", response_model=UserResponse)
async def patch_admin_user(
    user_id: UUID,
    user_in: AdminUserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_only),
):
    stmt = select(User).filter(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Validation guards
    if user_in.is_active is False and current_user.id == user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account")

    if user_in.role is not None and user_in.role != UserRole.admin and current_user.id == user.id:
        raise HTTPException(status_code=400, detail="Cannot modify your own administrative role")

    if user_in.role is not None:
        user.role = user_in.role
    if user_in.is_active is not None:
        user.is_active = user_in.is_active
    if user_in.specialty is not None:
        user.specialty = user_in.specialty
    if user_in.bio is not None:
        user.bio = user_in.bio

    await db.commit()
    await db.refresh(user)

    return UserResponse.model_validate(user)
