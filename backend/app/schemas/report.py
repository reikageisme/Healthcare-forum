from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from app.models.report import ReportStatus, ReportTargetType
from app.schemas.user import UserResponse

class ReportCreate(BaseModel):
    target_type: ReportTargetType
    target_id: UUID
    report_type: Optional[str] = "spam"
    reason: str = Field(..., min_length=1, max_length=255)
    details: Optional[str] = None

class ReportUpdateStatus(BaseModel):
    status: ReportStatus
    resolution_notes: Optional[str] = None

class ReportResponse(BaseModel):
    id: UUID
    reporter_id: UUID
    target_type: ReportTargetType
    target_id: UUID
    report_type: Optional[str] = None
    reason: str
    details: Optional[str] = None
    status: ReportStatus
    resolution_notes: Optional[str] = None
    resolved_by: Optional[UUID] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    reporter: Optional[UserResponse] = None
    resolver: Optional[UserResponse] = None
    target_title: Optional[str] = None
    target_author_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class ReportListPage(BaseModel):
    items: List[ReportResponse]
    total: int
    page: int = 1
    limit: int = 20
    total_pages: int = 1
    pages: Optional[int] = None
