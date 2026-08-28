import base64
import json
import re
import uuid
from datetime import datetime
from typing import List, Optional, Dict
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from slugify import slugify
from sqlalchemy import func, or_, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, get_optional_current_user
from app.core.database import get_db
from app.models.bookmark import Bookmark
from app.models.category import Category
from app.models.post import Post, PostType, PostStatus
from app.models.reaction import Reaction, ReactionType
from app.models.tag import Tag, post_tags
from app.models.user import User, UserRole
from app.schemas.category import CategoryResponse
from app.schemas.post import (
    PostCreate,
    PostCursorPage,
    PostDetailResponse,
    PostSummaryResponse,
    PostUpdate,
)
from app.schemas.tag import TagResponse
from app.schemas.user import UserResponse

router = APIRouter(prefix="/posts", tags=["posts"])


def strip_html_and_truncate(html_content: str, max_length: int = 200) -> str:
    clean = re.sub(r"<[^>]+>", " ", html_content)
    clean = " ".join(clean.split())
    if len(clean) > max_length:
        return clean[:max_length] + "..."
    return clean


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


async def generate_unique_slug(title: str, db: AsyncSession, exclude_post_id: Optional[UUID] = None) -> str:
    base_slug = slugify(title)
    if not base_slug:
        base_slug = "post"
    
    slug = base_slug
    attempt = 0
    while True:
        query = select(Post).filter(Post.slug == slug)
        if exclude_post_id:
            query = query.filter(Post.id != exclude_post_id)
        result = await db.execute(query)
        if not result.scalars().first():
            return slug
        attempt += 1
        slug = f"{base_slug}-{uuid.uuid4().hex[:6]}"


async def resolve_tags(tag_names: List[str], db: AsyncSession) -> List[Tag]:
    tags = []
    seen = set()
    for raw_name in tag_names:
        name = raw_name.strip()
        if not name or name.lower() in seen:
            continue
        seen.add(name.lower())
        tag_slug = slugify(name) or name.lower()
        
        # Check if tag already exists
        result = await db.execute(
            select(Tag).filter((Tag.slug == tag_slug) | (Tag.name.ilike(name)))
        )
        tag = result.scalars().first()
        if not tag:
            tag = Tag(name=name, slug=tag_slug)
            db.add(tag)
            await db.flush()
        tags.append(tag)
    return tags


async def get_reaction_breakdown(post_id: UUID, db: AsyncSession) -> Dict[str, int]:
    stmt = (
        select(Reaction.reaction_type, func.count(Reaction.id))
        .filter(Reaction.post_id == post_id)
        .group_by(Reaction.reaction_type)
    )
    result = await db.execute(stmt)
    breakdown = {"helpful": 0, "like": 0, "informative": 0, "total": 0}
    for r_type, count in result.all():
        key = r_type.value.lower()
        if key in breakdown:
            breakdown[key] = count
            breakdown["total"] += count
    return breakdown


@router.post("", response_model=PostDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_post(
    post_in: PostCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify category if provided
    if post_in.category_id:
        cat_result = await db.execute(
            select(Category).filter(Category.id == post_in.category_id)
        )
        if not cat_result.scalars().first():
            raise HTTPException(status_code=404, detail="Category not found")
    
    # Generate unique slug
    slug = await generate_unique_slug(post_in.title, db)
    
    # Generate excerpt if not provided
    excerpt = post_in.excerpt
    if not excerpt:
        excerpt = strip_html_and_truncate(post_in.content)
    
    # Resolve tags
    raw_tags = post_in.tags or post_in.tag_names or []
    tags = await resolve_tags(raw_tags, db)
    
    # Hybrid Moderation: Doctor/Moderator/Admin posts are auto-approved; User posts are pending
    if current_user.role in [UserRole.doctor, UserRole.moderator, UserRole.admin]:
        initial_status = PostStatus.APPROVED
    else:
        initial_status = PostStatus.PENDING

    new_post = Post(
        title=post_in.title,
        slug=slug,
        content=post_in.content,
        excerpt=excerpt,
        thumbnail=post_in.thumbnail,
        post_type=post_in.post_type,
        status=initial_status,
        author_id=current_user.id,
        category_id=post_in.category_id,
        tags=tags,
    )
    db.add(new_post)
    await db.commit()
    
    # Reload post with relationships
    stmt = (
        select(Post)
        .options(
            selectinload(Post.author),
            selectinload(Post.category),
            selectinload(Post.tags),
        )
        .filter(Post.id == new_post.id)
    )
    result = await db.execute(stmt)
    post = result.scalars().first()
    
    breakdown = {"helpful": 0, "like": 0, "informative": 0, "total": 0}
    
    return PostDetailResponse(
        id=post.id,
        title=post.title,
        slug=post.slug,
        content=post.content,
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
        user_reaction=None,
        is_bookmarked=False,
        reaction_breakdown=breakdown,
    )


@router.get("", response_model=PostCursorPage)
async def list_posts(
    cursor: Optional[str] = Query(None, description="Base64 encoded pagination cursor"),
    limit: int = Query(10, ge=1, le=50),
    tag: Optional[str] = Query(None, description="Filter by tag slug or name"),
    category: Optional[str] = Query(None, description="Filter by category slug or id"),
    post_type: Optional[str] = Query(None, description="Filter by post type (article/question/review/share)"),
    author_id: Optional[UUID] = Query(None, description="Filter by author ID"),
    status: Optional[str] = Query(None, description="Filter by status (pending, approved, rejected, all)"),
    search: Optional[str] = Query(None, description="Search keyword in title/content"),
    sort_by: str = Query("newest", description="Sorting option: newest, popular"),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    stmt = (
        select(Post)
        .options(
            selectinload(Post.author),
            selectinload(Post.category),
            selectinload(Post.tags),
        )
        .filter(Post.is_published == True)
    )
    
    # Moderation & Visibility Filter
    is_admin_or_mod = current_user and current_user.role in [UserRole.admin, UserRole.moderator]
    is_author_query = author_id and current_user and current_user.id == author_id

    if is_author_query or is_admin_or_mod:
        if status and status.lower() != "all":
            try:
                st_enum = PostStatus(status.lower())
                stmt = stmt.filter(Post.status == st_enum)
            except ValueError:
                pass
        elif not is_author_query and not status:
            stmt = stmt.filter(Post.status == PostStatus.APPROVED)
    else:
        stmt = stmt.filter(Post.status == PostStatus.APPROVED)

    # Filter by category
    if category:
        try:
            cat_uuid = UUID(category)
            stmt = stmt.filter(Post.category_id == cat_uuid)
        except ValueError:
            stmt = stmt.join(Post.category).filter(
                (Category.slug == category) | (Category.name.ilike(category))
            )
    
    # Filter by tag
    if tag:
        stmt = stmt.join(Post.tags).filter(
            (Tag.slug == tag) | (Tag.name.ilike(tag))
        )
    
    # Filter by post_type
    if post_type:
        p_type_val = post_type.lower()
        for pt in PostType:
            if pt.value.lower() == p_type_val:
                stmt = stmt.filter(Post.post_type == pt)
                break
    
    # Filter by author_id
    if author_id:
        stmt = stmt.filter(Post.author_id == author_id)
    
    # Search in title or content
    if search and search.strip():
        term = f"%{search.strip()}%"
        stmt = stmt.filter(or_(Post.title.ilike(term), Post.content.ilike(term)))
    
    # Keyset cursor pagination
    if cursor:
        decoded = decode_cursor(cursor)
        if decoded:
            cursor_time, cursor_id = decoded
            stmt = stmt.filter(
                or_(
                    Post.created_at < cursor_time,
                    and_(Post.created_at == cursor_time, Post.id < cursor_id),
                )
            )
    
    # Sort order
    if sort_by == "popular":
        stmt = stmt.order_by(Post.helpful_count.desc(), Post.created_at.desc(), Post.id.desc())
    else:
        stmt = stmt.order_by(Post.created_at.desc(), Post.id.desc())
    
    stmt = stmt.limit(limit + 1)
    
    result = await db.execute(stmt)
    posts = result.scalars().all()
    
    has_more = len(posts) > limit
    items = posts[:limit]
    
    next_cursor = None
    if has_more and items:
        last_item = items[-1]
        next_cursor = encode_cursor(last_item.created_at, last_item.id)
    
    # Pre-fetch current user reactions and bookmarks
    user_reactions = {}
    user_bookmarks = set()
    if current_user and items:
        post_ids = [p.id for p in items]
        rx_result = await db.execute(
            select(Reaction).filter(
                Reaction.user_id == current_user.id,
                Reaction.post_id.in_(post_ids),
            )
        )
        for rx in rx_result.scalars().all():
            user_reactions[rx.post_id] = rx.reaction_type.value
        
        bm_result = await db.execute(
            select(Bookmark.post_id).filter(
                Bookmark.user_id == current_user.id,
                Bookmark.post_id.in_(post_ids),
            )
        )
        user_bookmarks = set(bm_result.scalars().all())
    
    response_items = []
    for p in items:
        summary = PostSummaryResponse(
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
            user_reaction=user_reactions.get(p.id),
            is_bookmarked=p.id in user_bookmarks,
        )
        response_items.append(summary)
    
    return PostCursorPage(
        items=response_items,
        next_cursor=next_cursor,
        has_more=has_more,
        limit=limit,
    )


@router.get("/{id_or_slug}", response_model=PostDetailResponse)
async def get_post_detail(
    id_or_slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    try:
        post_id = UUID(id_or_slug)
        stmt = (
            select(Post)
            .options(
                selectinload(Post.author),
                selectinload(Post.category),
                selectinload(Post.tags),
            )
            .filter(Post.id == post_id)
        )
    except ValueError:
        stmt = (
            select(Post)
            .options(
                selectinload(Post.author),
                selectinload(Post.category),
                selectinload(Post.tags),
            )
            .filter(Post.slug == id_or_slug)
        )
    
    result = await db.execute(stmt)
    post = result.scalars().first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Visibility check for pending/rejected posts:
    if post.status != PostStatus.APPROVED:
        is_author = current_user and current_user.id == post.author_id
        is_admin_or_mod = current_user and current_user.role in [UserRole.admin, UserRole.moderator]
        if not (is_author or is_admin_or_mod):
            raise HTTPException(status_code=404, detail="Post not found")
    
    # Increment view count
    post.view_count += 1
    await db.commit()
    
    # Reaction breakdown
    breakdown = await get_reaction_breakdown(post.id, db)
    
    # User reaction and bookmark status
    user_reaction = None
    is_bookmarked = False
    if current_user:
        rx_result = await db.execute(
            select(Reaction).filter(
                Reaction.user_id == current_user.id,
                Reaction.post_id == post.id,
            )
        )
        rx = rx_result.scalars().first()
        if rx:
            user_reaction = rx.reaction_type.value
        
        bm_result = await db.execute(
            select(Bookmark).filter(
                Bookmark.user_id == current_user.id,
                Bookmark.post_id == post.id,
            )
        )
        is_bookmarked = bm_result.scalars().first() is not None
    
    return PostDetailResponse(
        id=post.id,
        title=post.title,
        slug=post.slug,
        content=post.content,
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
        user_reaction=user_reaction,
        is_bookmarked=is_bookmarked,
        reaction_breakdown=breakdown,
    )



@router.put("/{id_or_slug}", response_model=PostDetailResponse)
async def update_post(
    id_or_slug: str,
    post_in: PostUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        post_id = UUID(id_or_slug)
        stmt = (
            select(Post)
            .options(
                selectinload(Post.author),
                selectinload(Post.category),
                selectinload(Post.tags),
            )
            .filter(Post.id == post_id)
        )
    except ValueError:
        stmt = (
            select(Post)
            .options(
                selectinload(Post.author),
                selectinload(Post.category),
                selectinload(Post.tags),
            )
            .filter(Post.slug == id_or_slug)
        )
    
    result = await db.execute(stmt)
    post = result.scalars().first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Check permissions
    is_author = post.author_id == current_user.id
    is_admin = current_user.role in [UserRole.admin, UserRole.moderator]
    if not (is_author or is_admin):
        raise HTTPException(status_code=403, detail="Not enough permissions to edit this post")
    
    if post_in.title is not None and post_in.title != post.title:
        post.title = post_in.title
        post.slug = await generate_unique_slug(post_in.title, db, exclude_post_id=post.id)
    
    if post_in.content is not None:
        post.content = post_in.content
        if post_in.excerpt is None:
            post.excerpt = strip_html_and_truncate(post_in.content)
    
    if post_in.excerpt is not None:
        post.excerpt = post_in.excerpt
    
    if post_in.thumbnail is not None:
        post.thumbnail = post_in.thumbnail
    
    if post_in.post_type is not None:
        post.post_type = post_in.post_type
    
    if post_in.category_id is not None:
        cat_result = await db.execute(
            select(Category).filter(Category.id == post_in.category_id)
        )
        if not cat_result.scalars().first():
            raise HTTPException(status_code=404, detail="Category not found")
        post.category_id = post_in.category_id
    
    raw_tags = post_in.tags or post_in.tag_names
    if raw_tags is not None:
        post.tags = await resolve_tags(raw_tags, db)
    
    await db.commit()
    await db.refresh(post)
    
    # Reload relationships
    stmt = (
        select(Post)
        .options(
            selectinload(Post.author),
            selectinload(Post.category),
            selectinload(Post.tags),
        )
        .filter(Post.id == post.id)
    )
    result = await db.execute(stmt)
    post = result.scalars().first()
    
    breakdown = await get_reaction_breakdown(post.id, db)
    
    return PostDetailResponse(
        id=post.id,
        title=post.title,
        slug=post.slug,
        content=post.content,
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
        user_reaction=None,
        is_bookmarked=False,
        reaction_breakdown=breakdown,
    )


@router.delete("/{id_or_slug}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post(
    id_or_slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        post_id = UUID(id_or_slug)
        stmt = select(Post).filter(Post.id == post_id)
    except ValueError:
        stmt = select(Post).filter(Post.slug == id_or_slug)
    
    result = await db.execute(stmt)
    post = result.scalars().first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Check permissions
    is_author = post.author_id == current_user.id
    is_admin = current_user.role in [UserRole.admin, UserRole.moderator]
    if not (is_author or is_admin):
        raise HTTPException(status_code=403, detail="Not enough permissions to delete this post")
    
    await db.delete(post)
    await db.commit()
