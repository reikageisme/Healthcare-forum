import asyncio
import uuid
import sys
import os

# Thêm đường dẫn để import được từ app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from app.core.database import async_session_maker
from app.models.user import User, UserRole
from app.core.security import verify_password, hash_password

async def create_admin():
    async with async_session_maker() as db:
        # Kiểm tra xem admin đã tồn tại chưa
        result = await db.execute(
            select(User).filter(
                (User.username == "admin") | (User.email == "admin@health.vn")
            )
        )
        admin = result.scalars().first()
        
        if admin:
            print("Admin account already exists.")
            return

        import bcrypt
        hashed_password = bcrypt.hashpw(b"admin123", bcrypt.gensalt()).decode("utf-8")
        
        new_admin = User(
            id=uuid.uuid4(),
            email="admin@health.vn",
            username="admin",
            full_name="Quản Trị Viên",
            hashed_password=hashed_password,
            role=UserRole.admin,
            is_active=True
        )
        db.add(new_admin)
        await db.commit()
        print("Demo admin created successfully!")

if __name__ == "__main__":
    asyncio.run(create_admin())
