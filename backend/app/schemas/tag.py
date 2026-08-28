from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from uuid import UUID
from datetime import datetime

class TagBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    slug: Optional[str] = Field(None, max_length=50)

class TagCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)

class TagResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class TagWithCount(TagResponse):
    post_count: int = 0
