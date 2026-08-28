import asyncio
import os
import uuid
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.security import hash_password, create_access_token
from app.models.user import User, UserRole
from app.models.category import Category
from app.models.tag import Tag
from app.models.post import Post, PostType, PostStatus
from app.models.comment import Comment
from app.models.reaction import Reaction, ReactionType
from app.models.bookmark import Bookmark
from app.models.report import Report, ReportStatus, ReportTargetType
from app.main import app

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = async_sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

@pytest_asyncio.fixture(scope="function")
async def db_session():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    async with TestingSessionLocal() as session:
        yield session
    
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest_asyncio.fixture(scope="function")
async def client(db_session: AsyncSession):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()

@pytest_asyncio.fixture(scope="function")
async def test_users(db_session: AsyncSession):
    user_id = uuid.uuid4()
    doctor_id = uuid.uuid4()
    moderator_id = uuid.uuid4()
    admin_id = uuid.uuid4()
    other_id = uuid.uuid4()
    
    user = User(
        id=user_id,
        email="user@test.com",
        username="testuser",
        hashed_password=hash_password("Password123!"),
        full_name="Test User",
        role=UserRole.user,
        is_active=True,
    )
    doctor = User(
        id=doctor_id,
        email="doctor@test.com",
        username="drtest",
        hashed_password=hash_password("Password123!"),
        full_name="Dr. Test",
        specialty="Nhi khoa",
        role=UserRole.doctor,
        is_active=True,
    )
    moderator = User(
        id=moderator_id,
        email="mod@test.com",
        username="moduser",
        hashed_password=hash_password("Password123!"),
        full_name="Mod User",
        role=UserRole.moderator,
        is_active=True,
    )
    admin = User(
        id=admin_id,
        email="admin@test.com",
        username="adminuser",
        hashed_password=hash_password("Password123!"),
        full_name="Admin User",
        role=UserRole.admin,
        is_active=True,
    )
    other = User(
        id=other_id,
        email="other@test.com",
        username="otheruser",
        hashed_password=hash_password("Password123!"),
        full_name="Other User",
        role=UserRole.user,
        is_active=True,
    )
    
    db_session.add_all([user, doctor, moderator, admin, other])
    await db_session.commit()
    
    user_token = create_access_token(subject=str(user_id), role=UserRole.user.value)
    doctor_token = create_access_token(subject=str(doctor_id), role=UserRole.doctor.value)
    moderator_token = create_access_token(subject=str(moderator_id), role=UserRole.moderator.value)
    admin_token = create_access_token(subject=str(admin_id), role=UserRole.admin.value)
    other_token = create_access_token(subject=str(other_id), role=UserRole.user.value)
    
    return {
        "user": user,
        "doctor": doctor,
        "moderator": moderator,
        "admin": admin,
        "other": other,
        "user_token": user_token,
        "doctor_token": doctor_token,
        "moderator_token": moderator_token,
        "admin_token": admin_token,
        "other_token": other_token,
    }

@pytest_asyncio.fixture(scope="function")
async def seed_data(db_session: AsyncSession, test_users):
    cat1 = Category(name="Nhi khoa", slug="nhi-khoa", icon="Baby", description="Chăm sóc sức khỏe trẻ em")
    cat2 = Category(name="Nội khoa", slug="noi-khoa", icon="HeartPulse", description="Bệnh lý người lớn")
    
    tag1 = Tag(name="Sốt xuất huyết", slug="sot-xuat-huyet")
    tag2 = Tag(name="Covid-19", slug="covid-19")
    tag3 = Tag(name="Dinh dưỡng", slug="dinh-duong")
    
    db_session.add_all([cat1, cat2, tag1, tag2, tag3])
    await db_session.commit()
    
    # Create sample post
    post1 = Post(
        title="Cách hạ sốt an toàn cho trẻ sơ sinh",
        slug="cach-ha-sot-an-toan-cho-tre-so-sinh",
        content="<p>Khi trẻ bị sốt trên 38.5 độ, phụ huynh cần chú ý cho trẻ uống thuốc hạ sốt theo chỉ dẫn...</p>",
        excerpt="Khi trẻ bị sốt trên 38.5 độ, phụ huynh cần chú ý...",
        post_type=PostType.ARTICLE,
        status=PostStatus.APPROVED,
        author_id=test_users["doctor"].id,
        category_id=cat1.id,
        tags=[tag1, tag3],
    )
    db_session.add(post1)
    await db_session.commit()
    await db_session.refresh(post1)
    
    return {
        "cat1": cat1,
        "cat2": cat2,
        "tag1": tag1,
        "tag2": tag2,
        "tag3": tag3,
        "post1": post1,
    }

