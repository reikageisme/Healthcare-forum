from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from typing import List, Optional
from uuid import UUID

from app.core.database import get_db
from app.models.tag import Tag, post_tags
from app.models.post import Post, PostStatus
from app.schemas.tag import TagResponse, TagWithCount

router = APIRouter(prefix="/tags", tags=["tags"])

@router.get("/hot", response_model=List[TagWithCount])
async def get_hot_tags(limit: int = Query(10, ge=1, le=50), db: AsyncSession = Depends(get_db)):
    # Join with post_tags and posts (where is_published == True and status == approved)
    stmt = (
        select(Tag, func.count(post_tags.c.post_id).label("post_count"))
        .outerjoin(post_tags, post_tags.c.tag_id == Tag.id)
        .outerjoin(Post, (Post.id == post_tags.c.post_id) & (Post.is_published == True) & (Post.status == PostStatus.APPROVED))
        .group_by(Tag.id)
        .order_by(func.count(post_tags.c.post_id).desc(), Tag.name.asc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    tags_with_counts = []
    for row in result.all():
        tag, count = row[0], row[1]
        tags_with_counts.append(TagWithCount(
            id=tag.id,
            name=tag.name,
            slug=tag.slug,
            created_at=tag.created_at,
            post_count=count
        ))
    return tags_with_counts

@router.get("/search", response_model=List[TagResponse])
async def search_tags(q: str = Query("", min_length=0), limit: int = Query(20, ge=1, le=50), db: AsyncSession = Depends(get_db)):
    if not q.strip():
        stmt = select(Tag).order_by(Tag.name.asc()).limit(limit)
    else:
        pattern = f"%{q.strip()}%"
        stmt = select(Tag).filter((Tag.name.ilike(pattern)) | (Tag.slug.ilike(pattern))).order_by(Tag.name.asc()).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()

@router.get("", response_model=List[TagResponse])
async def list_tags(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    stmt = select(Tag).order_by(Tag.name.asc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()

@router.get("/{id_or_slug}", response_model=TagWithCount)
async def get_tag(id_or_slug: str, db: AsyncSession = Depends(get_db)):
    try:
        tag_id = UUID(id_or_slug)
        stmt = (
            select(Tag, func.count(post_tags.c.post_id).label("post_count"))
            .outerjoin(post_tags, post_tags.c.tag_id == Tag.id)
            .outerjoin(Post, (Post.id == post_tags.c.post_id) & (Post.is_published == True) & (Post.status == PostStatus.APPROVED))
            .filter(Tag.id == tag_id)
            .group_by(Tag.id)
        )
    except ValueError:
        stmt = (
            select(Tag, func.count(post_tags.c.post_id).label("post_count"))
            .outerjoin(post_tags, post_tags.c.tag_id == Tag.id)
            .outerjoin(Post, (Post.id == post_tags.c.post_id) & (Post.is_published == True) & (Post.status == PostStatus.APPROVED))
            .filter(Tag.slug == id_or_slug)
            .group_by(Tag.id)
        )

    result = await db.execute(stmt)
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Tag not found")
    tag, count = row[0], row[1]
    return TagWithCount(
        id=tag.id,
        name=tag.name,
        slug=tag.slug,
        created_at=tag.created_at,
        post_count=count
    )
