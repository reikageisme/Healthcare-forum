from .auth import router as auth_router
from .users import router as users_router
from .posts import router as posts_router
from .comments import router as comments_router
from .reactions import router as reactions_router
from .bookmarks import router as bookmarks_router
from .tags import router as tags_router
from .categories import router as categories_router
from .upload import router as upload_router
from .reports import router as reports_router
from .admin import router as admin_router

__all__ = [
    "auth_router",
    "users_router",
    "posts_router",
    "comments_router",
    "reactions_router",
    "bookmarks_router",
    "tags_router",
    "categories_router",
    "upload_router",
    "reports_router",
    "admin_router",
]

