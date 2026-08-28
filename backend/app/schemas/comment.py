from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from app.schemas.user import UserResponse

class CommentBase(BaseModel):
    content: str = Field(..., min_length=1)

class CommentCreate(CommentBase):
    parent_id: Optional[UUID] = None

class CommentUpdate(BaseModel):
    content: str = Field(..., min_length=1)

class CommentResponse(BaseModel):
    id: UUID
    post_id: UUID
    parent_id: Optional[UUID] = None
    content: str
    vote_count: int = 0
    is_deleted: bool = False
    created_at: datetime
    updated_at: datetime
    author: Optional[UserResponse] = None
    replies: List["CommentResponse"] = Field(default_factory=list)
    
    model_config = ConfigDict(from_attributes=True)

# Required in Pydantic v2 to resolve recursive self-referential model
CommentResponse.model_rebuild()
