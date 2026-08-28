import base64
import json
from datetime import datetime
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_, and_, desc
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.bookmark import Bookmark
from app.models.post import Post
from app.models.reaction import Reaction
from app.models.user import User
from app.schemas.bookmark import BookmarkToggleResponse
from app.schemas.category import CategoryResponse
from app.schemas.post import PostCursorPage, PostSummaryResponse
from app.schemas.tag import TagResponse
from app.schemas.user import UserResponse
from app.api.deps import get_current_user

router = APIRouter(tags=["bookmarks"])

def encode_cursor(dt: datetime, post_id: UUID) -> str:
    payload = {"t": dt.isoformat(), "id": str(post_id)}
    json_bytes = json.dumps(payload).encode("utf-8")
    return base64.urlsafe_b64encode(json_bytes).decode("utf-8")

def decode_cursor(cursor_str: str) -> Optional[tuple[datetime, UUID]]:
    try:
        json_bytes = base64.urlsafe_b64decode(cursor_str.encode("utf-8"))
        payload = json.loads(json_bytes.decode("utf-8"))
        return datetime.fromisoformat(payload["t"]), UUID(payload["id"])
    except Exception:
        return None

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

@router.post("/posts/{post_id}/bookmark", response_model=BookmarkToggleResponse)
async def toggle_bookmark(
    post_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = await find_post(post_id, db)
    
    stmt = select(Bookmark).filter(
        Bookmark.user_id == current_user.id,
        Bookmark.post_id == post.id,
    )
    result = await db.execute(stmt)
    existing = result.scalars().first()
    
    if existing:
        await db.delete(existing)
        await db.commit()
        return BookmarkToggleResponse(is_bookmarked=False)
    else:
        new_bm = Bookmark(user_id=current_user.id, post_id=post.id)
        db.add(new_bm)
        await db.commit()
        return BookmarkToggleResponse(is_bookmarked=True)

@router.get("/users/me/bookmarks", response_model=PostCursorPage)
async def get_my_bookmarks(
    cursor: Optional[str] = Query(None, description="Base64 encoded pagination cursor"),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(Post, Bookmark.created_at.label("bookmark_created_at"))
        .join(Bookmark, Bookmark.post_id == Post.id)
        .options(
            selectinload(Post.author),
            selectinload(Post.category),
            selectinload(Post.tags),
        )
        .filter(Bookmark.user_id == current_user.id, Post.is_published == True)
    )
    
    if cursor:
        decoded = decode_cursor(cursor)
        if decoded:
            cursor_time, cursor_id = decoded
            stmt = stmt.filter(
                or_(
                    Bookmark.created_at < cursor_time,
                    and_(Bookmark.created_at == cursor_time, Post.id < cursor_id),
                )
            )
    
    stmt = stmt.order_by(Bookmark.created_at.desc(), Post.id.desc()).limit(limit + 1)
    
    result = await db.execute(stmt)
    rows = result.all()
    
    has_more = len(rows) > limit
    selected_rows = rows[:limit]
    
    next_cursor = None
    if has_more and selected_rows:
        last_post, last_bm_time = selected_rows[-1]
        next_cursor = encode_cursor(last_bm_time, last_post.id)
    
    post_ids = [r[0].id for r in selected_rows]
    user_reactions = {}
    if post_ids:
        rx_result = await db.execute(
            select(Reaction).filter(
                Reaction.user_id == current_user.id,
                Reaction.post_id.in_(post_ids),
            )
        )
        for rx in rx_result.scalars().all():
            user_reactions[rx.post_id] = rx.reaction_type.value
    
    items = []
    for post, _ in selected_rows:
        summary = PostSummaryResponse(
            id=post.id,
            title=post.title,
            slug=post.slug,
            excerpt=post.excerpt,
            thumbnail=post.thumbnail,
            post_type=post.post_type,
            view_count=post.view_count,
            helpful_count=post.helpful_count,
            comment_count=post.comment_count,
            is_published=post.is_published,
            created_at=post.created_at,
            updated_at=post.updated_at,
            author=UserResponse.model_validate(post.author),
            category=CategoryResponse.model_validate(post.category) if post.category else None,
            tags=[TagResponse.model_validate(t) for t in post.tags],
            user_reaction=user_reactions.get(post.id),
            is_bookmarked=True,
        )
        items.append(summary)
    
    return PostCursorPage(
        items=items,
        next_cursor=next_cursor,
        has_more=has_more,
        limit=limit,
    )
