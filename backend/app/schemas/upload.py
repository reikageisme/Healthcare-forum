from pydantic import BaseModel

class UploadResponse(BaseModel):
    url: str
    filename: str
    content_type: str
    size: int
