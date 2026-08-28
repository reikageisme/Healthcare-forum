from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Optional, List, Dict
from uuid import UUID
from datetime import datetime
from app.models.post import PostType, PostStatus
from app.schemas.user import UserResponse
from app.schemas.category import CategoryResponse
from app.schemas.tag import TagResponse

class PostCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=255)
    content: str = Field(..., min_length=5)
    excerpt: Optional[str] = Field(None, max_length=500)
    thumbnail: Optional[str] = None
    post_type: PostType = PostType.ARTICLE
    category_id: Optional[UUID] = None
    tags: Optional[List[str]] = Field(default_factory=list)
    tag_names: Optional[List[str]] = None

    @field_validator("post_type", mode="before")
    @classmethod
    def normalize_post_type(cls, v):
        if isinstance(v, str):
            v_lower = v.lower()
            for pt in PostType:
                if pt.value.lower() == v_lower:
                    return pt
        return v

class PostUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=255)
    content: Optional[str] = Field(None, min_length=5)
    excerpt: Optional[str] = Field(None, max_length=500)
    thumbnail: Optional[str] = None
    post_type: Optional[PostType] = None
    category_id: Optional[UUID] = None
    tags: Optional[List[str]] = None
    tag_names: Optional[List[str]] = None

    @field_validator("post_type", mode="before")
    @classmethod
    def normalize_post_type(cls, v):
        if isinstance(v, str):
            v_lower = v.lower()
            for pt in PostType:
                if pt.value.lower() == v_lower:
                    return pt
        return v

class PostModerationUpdate(BaseModel):
    status: PostStatus
    rejection_reason: Optional[str] = None
    reason: Optional[str] = None

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, v):
        if isinstance(v, str):
            v_lower = v.lower()
            for ps in PostStatus:
                if ps.value.lower() == v_lower:
                    return ps
        return v

class PostRejectRequest(BaseModel):
    reason: Optional[str] = None

class PostSummaryResponse(BaseModel):
    id: UUID
    title: str
    slug: str
    excerpt: Optional[str] = None
    thumbnail: Optional[str] = None
    post_type: PostType
    status: PostStatus = PostStatus.PENDING
    rejection_reason: Optional[str] = None
    view_count: int = 0
    helpful_count: int = 0
    comment_count: int = 0
    is_published: bool = True
    created_at: datetime
    updated_at: datetime
    author: UserResponse
    category: Optional[CategoryResponse] = None
    tags: List[TagResponse] = Field(default_factory=list)
    
    user_reaction: Optional[str] = None
    is_bookmarked: bool = False
    
    model_config = ConfigDict(from_attributes=True)

class PostDetailResponse(PostSummaryResponse):
    content: str
    reaction_breakdown: Dict[str, int] = Field(
        default_factory=lambda: {"helpful": 0, "like": 0, "informative": 0, "total": 0}
    )

class PostCursorPage(BaseModel):
    items: List[PostSummaryResponse]
    next_cursor: Optional[str] = None
    has_more: bool = False
    limit: int = 10
    total: Optional[int] = None

class PostListPage(BaseModel):
    items: List[PostSummaryResponse]
    total: int
    page: int = 1
    limit: int = 20
    total_pages: int = 1
    pages: Optional[int] = None

