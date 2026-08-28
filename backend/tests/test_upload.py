import io
import pytest
from httpx import AsyncClient
from PIL import Image

def generate_test_image(format="PNG") -> bytes:
    file_obj = io.BytesIO()
    img = Image.new("RGB", (60, 30), color=(73, 109, 137))
    img.save(file_obj, format=format)
    file_obj.seek(0)
    return file_obj.read()

@pytest.mark.asyncio
async def test_image_upload_valid(client: AsyncClient, test_users):
    user_token = test_users["user_token"]
    img_bytes = generate_test_image("PNG")
    
    files = {"file": ("test_avatar.png", img_bytes, "image/png")}
    response = await client.post(
        "/api/v1/upload",
        files=files,
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert response.status_code == 201
    data = response.json()
    assert "url" in data
    assert data["url"].startswith("/uploads/")
    assert data["content_type"] == "image/png"
    assert data["size"] == len(img_bytes)

@pytest.mark.asyncio
async def test_image_upload_invalid_type(client: AsyncClient, test_users):
    user_token = test_users["user_token"]
    fake_txt = b"Hello world text file"
    
    files = {"file": ("test.txt", fake_txt, "text/plain")}
    response = await client.post(
        "/api/v1/upload",
        files=files,
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert response.status_code == 400

@pytest.mark.asyncio
async def test_image_upload_oversized(client: AsyncClient, test_users):
    user_token = test_users["user_token"]
    # 6MB dummy data with png extension
    oversized_bytes = b"0" * (6 * 1024 * 1024)
    
    files = {"file": ("big.png", oversized_bytes, "image/png")}
    response = await client.post(
        "/api/v1/upload",
        files=files,
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert response.status_code == 400
    assert "exceeds 5MB" in response.json()["detail"]
