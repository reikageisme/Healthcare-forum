from pydantic import BaseModel, field_validator
from typing import Optional
from app.models.reaction import ReactionType

class ReactionCreate(BaseModel):
    reaction_type: ReactionType

    @field_validator("reaction_type", mode="before")
    @classmethod
    def normalize_reaction_type(cls, v):
        if isinstance(v, str):
            v_lower = v.lower()
            for r in ReactionType:
                if r.value.lower() == v_lower:
                    return r
        return v

class ReactionCounts(BaseModel):
    helpful: int = 0
    like: int = 0
    informative: int = 0
    total: int = 0

class ReactionToggleResponse(BaseModel):
    success: bool = True
    action: str  # "added", "removed", "updated"
    current_reaction: Optional[str] = None
    counts: ReactionCounts
