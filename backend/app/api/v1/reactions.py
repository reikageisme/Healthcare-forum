from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from typing import Optional, Dict
from uuid import UUID

from app.core.database import get_db
from app.models.reaction import Reaction, ReactionType
from app.models.post import Post
from app.models.user import User
from app.schemas.reaction import ReactionCreate, ReactionCounts, ReactionToggleResponse
from app.api.deps import get_current_user, get_optional_current_user

router = APIRouter(tags=["reactions"])

async def find_post(id_or_slug: str, db: AsyncSession) -> Post:
    try:
        post_id = UUID(id_or_slug)
        stmt = select(Post).filter(Post.id == post_id)
    except ValueError:
        stmt = select(Post).filter(Post.slug == id_or_slug)
    result = await db.execute(stmt)
    post = result.scalars().first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return post

async def compute_reaction_counts(post_id: UUID, db: AsyncSession) -> ReactionCounts:
    stmt = (
        select(Reaction.reaction_type, func.count(Reaction.id))
        .filter(Reaction.post_id == post_id)
        .group_by(Reaction.reaction_type)
    )
    result = await db.execute(stmt)
    counts_dict = {"helpful": 0, "like": 0, "informative": 0, "total": 0}
    for r_type, count in result.all():
        key = r_type.value.lower()
        if key in counts_dict:
            counts_dict[key] = count
            counts_dict["total"] += count
    return ReactionCounts(**counts_dict)

@router.post("/posts/{post_id}/reactions", response_model=ReactionToggleResponse)
async def toggle_reaction(
    post_id: str,
    reaction_in: ReactionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = await find_post(post_id, db)
    
    # Check existing reaction
    existing_stmt = select(Reaction).filter(
        Reaction.user_id == current_user.id,
        Reaction.post_id == post.id,
    )
    existing_res = await db.execute(existing_stmt)
    existing = existing_res.scalars().first()
    
    action = "added"
    current_reaction = None
    
    if not existing:
        # Create reaction
        new_rx = Reaction(
            user_id=current_user.id,
            post_id=post.id,
            reaction_type=reaction_in.reaction_type,
        )
        db.add(new_rx)
        action = "added"
        current_reaction = reaction_in.reaction_type.value
    elif existing.reaction_type == reaction_in.reaction_type:
        # Toggle off (remove)
        await db.delete(existing)
        action = "removed"
        current_reaction = None
    else:
        # Switch type
        existing.reaction_type = reaction_in.reaction_type
        action = "updated"
        current_reaction = reaction_in.reaction_type.value
    
    await db.flush()
    
    counts = await compute_reaction_counts(post.id, db)
    post.helpful_count = counts.helpful
    
    await db.commit()
    
    return ReactionToggleResponse(
        success=True,
        action=action,
        current_reaction=current_reaction,
        counts=counts,
    )

@router.get("/posts/{post_id}/reactions")
async def get_reactions(
    post_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    post = await find_post(post_id, db)
    counts = await compute_reaction_counts(post.id, db)
    
    user_reaction = None
    if current_user:
        rx_stmt = select(Reaction).filter(
            Reaction.user_id == current_user.id,
            Reaction.post_id == post.id,
        )
        rx_res = await db.execute(rx_stmt)
        rx = rx_res.scalars().first()
        if rx:
            user_reaction = rx.reaction_type.value
    
    return {
        "counts": counts,
        "user_reaction": user_reaction,
    }
