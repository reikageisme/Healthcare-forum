from sqlalchemy import Enum as SAEnum
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from app.core.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=True)
async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()


def enum_column(py_enum):
    """Postgres enum column storing the member *value* (lowercase).

    SQLAlchemy defaults to persisting the member *name* (e.g. 'APPROVED'), but the
    Alembic migrations create the types with lowercase labels ('approved'), so the
    default blows up with `invalid input value for enum ...`.
    """
    return SAEnum(py_enum, values_callable=lambda e: [m.value for m in e])

async def get_db():
    async with async_session_maker() as session:
        yield session
