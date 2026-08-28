import io
import os
import uuid
import aiofiles
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from PIL import Image

from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.upload import UploadResponse

router = APIRouter(tags=["upload"])

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
ALLOWED_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
UPLOAD_DIR = os.path.join(os.getcwd(), "uploads")

@router.post("/upload", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    # Validate extension
    filename = file.filename or ""
    _, ext = os.path.splitext(filename)
    ext = ext.lower()
    
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file extension: {ext}. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )
    
    # Validate content type
    content_type = file.content_type or ""
    if content_type.lower() not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported content type: {content_type}. Allowed: {', '.join(ALLOWED_MIME_TYPES)}",
        )
    
    # Read file content with size limit check
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File size exceeds 5MB limit. Got {len(content)} bytes.",
        )
    
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty file upload is not allowed.")
    
    # Validate actual image data using Pillow
    try:
        image = Image.open(io.BytesIO(content))
        image.verify()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file or corrupted image data.")
    
    # Generate unique filename
    target_filename = f"{uuid.uuid4().hex}{ext}"
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    target_path = os.path.join(UPLOAD_DIR, target_filename)
    
    # Write to local filesystem asynchronously
    async with aiofiles.open(target_path, "wb") as f:
        await f.write(content)
    
    return UploadResponse(
        url=f"/uploads/{target_filename}",
        filename=target_filename,
        content_type=content_type,
        size=len(content),
    )
