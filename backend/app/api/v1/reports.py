from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from uuid import UUID

from app.core.database import get_db
from app.models.report import Report, ReportStatus, ReportTargetType
from app.models.post import Post
from app.models.comment import Comment
from app.models.user import User
from app.schemas.report import ReportCreate, ReportResponse
from app.schemas.user import UserResponse
from app.api.deps import get_current_user

router = APIRouter(prefix="/reports", tags=["reports"])

@router.post("", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
async def create_report(
    report_in: ReportCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 1. Validate target entity exists
    if report_in.target_type == ReportTargetType.POST:
        target_res = await db.execute(select(Post).filter(Post.id == report_in.target_id))
        target_post = target_res.scalars().first()
        if not target_post:
            raise HTTPException(status_code=404, detail="Target post not found")
        target_title = target_post.title
    elif report_in.target_type == ReportTargetType.COMMENT:
        target_res = await db.execute(select(Comment).filter(Comment.id == report_in.target_id))
        target_comment = target_res.scalars().first()
        if not target_comment:
            raise HTTPException(status_code=404, detail="Target comment not found")
        target_title = target_comment.content[:50]
    elif report_in.target_type == ReportTargetType.USER:
        target_res = await db.execute(select(User).filter(User.id == report_in.target_id))
        target_user = target_res.scalars().first()
        if not target_user:
            raise HTTPException(status_code=404, detail="Target user not found")
        target_title = target_user.username
    else:
        raise HTTPException(status_code=400, detail="Invalid target type")

    # 2. Prevent duplicate open reports from same user on same target
    existing_stmt = select(Report).filter(
        Report.reporter_id == current_user.id,
        Report.target_type == report_in.target_type,
        Report.target_id == report_in.target_id,
        Report.status == ReportStatus.OPEN,
    )
    existing_res = await db.execute(existing_stmt)
    if existing_res.scalars().first():
        raise HTTPException(status_code=400, detail="You have already reported this content")

    # 3. Create Report
    report = Report(
        reporter_id=current_user.id,
        target_type=report_in.target_type,
        target_id=report_in.target_id,
        report_type=report_in.report_type or "spam",
        reason=report_in.reason,
        details=report_in.details,
        status=ReportStatus.OPEN,
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)

    return ReportResponse(
        id=report.id,
        reporter_id=report.reporter_id,
        target_type=report_in.target_type,
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
        reporter=UserResponse.model_validate(current_user),
        target_title=target_title,
    )
