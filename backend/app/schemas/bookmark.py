from pydantic import BaseModel

class BookmarkToggleResponse(BaseModel):
    is_bookmarked: bool
