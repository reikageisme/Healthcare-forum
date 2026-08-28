from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from sqlalchemy.orm import selectinload
from typing import List, Optional
from uuid import UUID

from app.core.database import get_db
from app.models.comment import Comment
from app.models.post import Post
from app.models.user import User, UserRole
from app.schemas.comment import CommentCreate, CommentUpdate, CommentResponse
from app.schemas.user import UserResponse
from app.api.deps import get_current_user

router = APIRouter(tags=["comments"])

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

@router.post("/posts/{post_id}/comments", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
async def create_comment(
    post_id: str,
    comment_in: CommentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = await find_post(post_id, db)
    
    if comment_in.parent_id:
        parent_result = await db.execute(select(Comment).filter(Comment.id == comment_in.parent_id))
        parent = parent_result.scalars().first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent comment not found")
        if parent.post_id != post.id:
            raise HTTPException(status_code=400, detail="Parent comment belongs to a different post")
    
    new_comment = Comment(
        post_id=post.id,
        parent_id=comment_in.parent_id,
        author_id=current_user.id,
        content=comment_in.content,
    )
    db.add(new_comment)
    post.comment_count += 1
    
    await db.commit()
    await db.refresh(new_comment)
    
    # Reload author
    stmt = select(Comment).options(selectinload(Comment.author)).filter(Comment.id == new_comment.id)
    result = await db.execute(stmt)
    comment = result.scalars().first()
    
    return CommentResponse(
        id=comment.id,
        post_id=comment.post_id,
        parent_id=comment.parent_id,
        content=comment.content,
        vote_count=comment.vote_count,
        is_deleted=comment.is_deleted,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
        author=UserResponse.model_validate(comment.author) if comment.author else None,
        replies=[],
    )

@router.get("/posts/{post_id}/comments", response_model=List[CommentResponse])
async def get_comments_tree(
    post_id: str,
    sort_by: str = Query("newest", description="Sorting option: newest, oldest, popular"),
    db: AsyncSession = Depends(get_db),
):
    post = await find_post(post_id, db)
    
    # Single query to fetch all comments for post
    stmt = (
        select(Comment)
        .options(selectinload(Comment.author))
        .filter(Comment.post_id == post.id)
        .order_by(Comment.created_at.asc())
    )
    result = await db.execute(stmt)
    all_comments = result.scalars().all()
    
    # Build in-memory hierarchical tree
    nodes: dict[UUID, CommentResponse] = {}
    for c in all_comments:
        display_content = "[Bình luận đã bị xóa]" if c.is_deleted else c.content
        display_author = None if (c.is_deleted and not c.author) else (UserResponse.model_validate(c.author) if c.author else None)
        
        nodes[c.id] = CommentResponse(
            id=c.id,
            post_id=c.post_id,
            parent_id=c.parent_id,
            content=display_content,
            vote_count=c.vote_count,
            is_deleted=c.is_deleted,
            created_at=c.created_at,
            updated_at=c.updated_at,
            author=display_author,
            replies=[],
        )
    
    root_comments: List[CommentResponse] = []
    for c in all_comments:
        node = nodes[c.id]
        if c.parent_id and c.parent_id in nodes:
            nodes[c.parent_id].replies.append(node)
        else:
            root_comments.append(node)
    
    # Sort root comments according to requested strategy
    if sort_by == "newest":
        root_comments.sort(key=lambda x: x.created_at, reverse=True)
    elif sort_by == "popular":
        root_comments.sort(key=lambda x: x.vote_count, reverse=True)
    # oldest is already asc
    
    return root_comments

@router.put("/comments/{comment_id}", response_model=CommentResponse)
async def update_comment(
    comment_id: UUID,
    comment_in: CommentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Comment).options(selectinload(Comment.author)).filter(Comment.id == comment_id)
    result = await db.execute(stmt)
    comment = result.scalars().first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    is_author = comment.author_id == current_user.id
    is_admin = current_user.role in [UserRole.admin, UserRole.moderator]
    if not (is_author or is_admin):
        raise HTTPException(status_code=403, detail="Not enough permissions to edit this comment")
    
    if comment.is_deleted:
        raise HTTPException(status_code=400, detail="Cannot edit a deleted comment")
    
    comment.content = comment_in.content
    await db.commit()
    await db.refresh(comment)
    
    return CommentResponse(
        id=comment.id,
        post_id=comment.post_id,
        parent_id=comment.parent_id,
        content=comment.content,
        vote_count=comment.vote_count,
        is_deleted=comment.is_deleted,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
        author=UserResponse.model_validate(comment.author) if comment.author else None,
        replies=[],
    )

@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    comment_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Comment).filter(Comment.id == comment_id)
    result = await db.execute(stmt)
    comment = result.scalars().first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    is_author = comment.author_id == current_user.id
    is_admin = current_user.role in [UserRole.admin, UserRole.moderator]
    if not (is_author or is_admin):
        raise HTTPException(status_code=403, detail="Not enough permissions to delete this comment")
    
    # Check if comment has replies
    replies_count_stmt = select(func.count(Comment.id)).filter(Comment.parent_id == comment.id)
    replies_count_res = await db.execute(replies_count_stmt)
    has_replies = (replies_count_res.scalar() or 0) > 0
    
    # Load post to decrement comment count
    post_stmt = select(Post).filter(Post.id == comment.post_id)
    post_res = await db.execute(post_stmt)
    post = post_res.scalars().first()
    if post and post.comment_count > 0:
        post.comment_count -= 1
    
    if has_replies:
        # Tombstone soft deletion
        comment.is_deleted = True
        comment.content = "[Bình luận đã bị xóa]"
    else:
        # Hard delete
        await db.delete(comment)
    
    await db.commit()
