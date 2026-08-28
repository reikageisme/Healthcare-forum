from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from typing import List
from slugify import slugify
from uuid import UUID

from app.core.database import get_db
from app.models.category import Category
from app.models.post import Post, PostStatus
from app.models.user import User, UserRole
from app.schemas.category import CategoryCreate, CategoryUpdate, CategoryResponse
from app.api.deps import get_current_user, require_role

router = APIRouter(prefix="/categories", tags=["categories"])

@router.get("", response_model=List[CategoryResponse])
async def list_categories(db: AsyncSession = Depends(get_db)):
    # Query categories with post count (approved & published posts only)
    stmt = (
        select(Category, func.count(Post.id).label("post_count"))
        .outerjoin(Post, (Post.category_id == Category.id) & (Post.is_published == True) & (Post.status == PostStatus.APPROVED))
        .group_by(Category.id)
        .order_by(Category.name.asc())
    )
    result = await db.execute(stmt)
    categories_with_counts = []
    for row in result.all():
        category, count = row[0], row[1]
        cat_resp = CategoryResponse(
            id=category.id,
            name=category.name,
            slug=category.slug,
            icon=category.icon,
            description=category.description,
            created_at=category.created_at,
            post_count=count
        )
        categories_with_counts.append(cat_resp)
    return categories_with_counts

@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    cat_in: CategoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.admin, UserRole.moderator]))
):
    slug = cat_in.slug or slugify(cat_in.name)
    # Check duplicate name or slug
    existing = await db.execute(
        select(Category).filter((Category.name == cat_in.name) | (Category.slug == slug))
    )
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Category with this name or slug already exists")
    
    category = Category(
        name=cat_in.name,
        slug=slug,
        icon=cat_in.icon,
        description=cat_in.description
    )
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return CategoryResponse(
        id=category.id,
        name=category.name,
        slug=category.slug,
        icon=category.icon,
        description=category.description,
        created_at=category.created_at,
        post_count=0
    )

@router.get("/{id_or_slug}", response_model=CategoryResponse)
async def get_category(id_or_slug: str, db: AsyncSession = Depends(get_db)):
    try:
        cat_id = UUID(id_or_slug)
        stmt = (
            select(Category, func.count(Post.id).label("post_count"))
            .outerjoin(Post, (Post.category_id == Category.id) & (Post.is_published == True) & (Post.status == PostStatus.APPROVED))
            .filter(Category.id == cat_id)
            .group_by(Category.id)
        )
    except ValueError:
        stmt = (
            select(Category, func.count(Post.id).label("post_count"))
            .outerjoin(Post, (Post.category_id == Category.id) & (Post.is_published == True) & (Post.status == PostStatus.APPROVED))
            .filter(Category.slug == id_or_slug)
            .group_by(Category.id)
        )
    
    result = await db.execute(stmt)
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Category not found")
    
    category, count = row[0], row[1]
    return CategoryResponse(
        id=category.id,
        name=category.name,
        slug=category.slug,
        icon=category.icon,
        description=category.description,
        created_at=category.created_at,
        post_count=count
    )

@router.put("/{id_or_slug}", response_model=CategoryResponse)
async def update_category(
    id_or_slug: str,
    cat_in: CategoryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.admin, UserRole.moderator]))
):
    try:
        cat_id = UUID(id_or_slug)
        stmt = select(Category).filter(Category.id == cat_id)
    except ValueError:
        stmt = select(Category).filter(Category.slug == id_or_slug)
        
    result = await db.execute(stmt)
    category = result.scalars().first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
        
    if cat_in.name is not None:
        category.name = cat_in.name
    if cat_in.slug is not None:
        # Check slug uniqueness
        new_slug = cat_in.slug
        existing = await db.execute(
            select(Category).filter(Category.slug == new_slug, Category.id != category.id)
        )
        if existing.scalars().first():
            raise HTTPException(status_code=400, detail="Category slug already exists")
        category.slug = new_slug
    elif cat_in.name is not None:
        # If name changed but slug not explicitly passed, recompute slug
        new_slug = slugify(cat_in.name)
        existing = await db.execute(
            select(Category).filter(Category.slug == new_slug, Category.id != category.id)
        )
        if not existing.scalars().first():
            category.slug = new_slug
            
    if cat_in.icon is not None:
        category.icon = cat_in.icon
    if cat_in.description is not None:
        category.description = cat_in.description
        
    await db.commit()
    await db.refresh(category)
    
    # Get post count
    count_stmt = select(func.count(Post.id)).filter(
        Post.category_id == category.id,
        Post.is_published == True,
        Post.status == PostStatus.APPROVED
    )
    count_res = await db.execute(count_stmt)
    count = count_res.scalar() or 0
    
    return CategoryResponse(
        id=category.id,
        name=category.name,
        slug=category.slug,
        icon=category.icon,
        description=category.description,
        created_at=category.created_at,
        post_count=count
    )

@router.delete("/{id_or_slug}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    id_or_slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.admin]))
):
    try:
        cat_id = UUID(id_or_slug)
        stmt = select(Category).filter(Category.id == cat_id)
    except ValueError:
        stmt = select(Category).filter(Category.slug == id_or_slug)
        
    result = await db.execute(stmt)
    category = result.scalars().first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
        
    await db.delete(category)
    await db.commit()

