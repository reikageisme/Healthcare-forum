import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_create_post_authenticated(client: AsyncClient, test_users, seed_data):
    token = test_users["user_token"]
    cat_id = str(seed_data["cat1"].id)
    
    payload = {
        "title": "Bé 2 tuổi biếng ăn phải làm sao?",
        "content": "<p>Chào các bác sĩ, bé nhà em dạo này lười ăn quá, có cách nào cải thiện không ạ?</p>",
        "post_type": "question",
        "category_id": cat_id,
        "tags": ["Dinh dưỡng", "Biếng ăn"],
    }
    
    response = await client.post(
        "/api/v1/posts",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == payload["title"]
    assert data["slug"].startswith("be-2-tuoi-bieng-an-phai-lam-sao")
    assert data["post_type"] == "question"
    assert data["status"] == "pending"
    assert data["category"]["id"] == cat_id
    assert len(data["tags"]) == 2
    assert data["author"]["username"] == "testuser"
    assert data["excerpt"] is not None

@pytest.mark.asyncio
async def test_create_post_unauthenticated(client: AsyncClient, seed_data):
    payload = {
        "title": "Bài viết chưa đăng nhập",
        "content": "Nội dung bài viết thử nghiệm không đăng nhập",
    }
    response = await client.post("/api/v1/posts", json=payload)
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_list_posts_and_cursor_pagination(client: AsyncClient, test_users, seed_data):
    token = test_users["doctor_token"]
    
    # Create 5 posts
    for i in range(5):

        await client.post(
            "/api/v1/posts",
            json={
                "title": f"Bài viết số {i+1} về sức khỏe",
                "content": f"Nội dung chi tiết cho bài viết số {i+1}",
                "post_type": "article",
                "category_id": str(seed_data["cat1"].id),
                "tags": ["Sốt xuất huyết"],
            },
            headers={"Authorization": f"Bearer {token}"},
        )
    
    # Request page 1 with limit=3
    res1 = await client.get("/api/v1/posts?limit=3")
    assert res1.status_code == 200
    page1 = res1.json()
    assert len(page1["items"]) == 3
    assert page1["has_more"] is True
    assert page1["next_cursor"] is not None
    
    # Request page 2 using next_cursor
    res2 = await client.get(f"/api/v1/posts?limit=3&cursor={page1['next_cursor']}")
    assert res2.status_code == 200
    page2 = res2.json()
    assert len(page2["items"]) == 3  # 5 created + 1 from seed = 6 total
    
    # Verify no overlapping items between page 1 and page 2
    page1_ids = {item["id"] for item in page1["items"]}
    page2_ids = {item["id"] for item in page2["items"]}
    assert len(page1_ids.intersection(page2_ids)) == 0

@pytest.mark.asyncio
async def test_get_post_detail_and_view_counter(client: AsyncClient, seed_data):
    post_id = str(seed_data["post1"].id)
    
    # Initial view
    res1 = await client.get(f"/api/v1/posts/{post_id}")
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["id"] == post_id
    assert data1["view_count"] == 1
    
    # Second view increments counter
    res2 = await client.get(f"/api/v1/posts/{post_id}")
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["view_count"] == 2

@pytest.mark.asyncio
async def test_update_post_author_vs_non_author(client: AsyncClient, test_users, seed_data):
    post_id = str(seed_data["post1"].id)
    doctor_token = test_users["doctor_token"]
    other_token = test_users["other_token"]
    admin_token = test_users["admin_token"]
    
    # Non-author cannot update
    res_forbidden = await client.put(
        f"/api/v1/posts/{post_id}",
        json={"title": "Hack bài viết của bác sĩ"},
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert res_forbidden.status_code == 403
    
    # Author (Doctor) can update
    res_author = await client.put(
        f"/api/v1/posts/{post_id}",
        json={"title": "Hướng dẫn hạ sốt cho trẻ sơ sinh (Đã cập nhật)"},
        headers={"Authorization": f"Bearer {doctor_token}"},
    )
    assert res_author.status_code == 200
    assert res_author.json()["title"] == "Hướng dẫn hạ sốt cho trẻ sơ sinh (Đã cập nhật)"
    
    # Admin can also update
    res_admin = await client.put(
        f"/api/v1/posts/{post_id}",
        json={"title": "Hướng dẫn hạ sốt chuẩn y khoa bởi Bác sĩ"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res_admin.status_code == 200
    assert res_admin.json()["title"] == "Hướng dẫn hạ sốt chuẩn y khoa bởi Bác sĩ"

@pytest.mark.asyncio
async def test_delete_post_rbac(client: AsyncClient, test_users, seed_data):
    post_id = str(seed_data["post1"].id)
    other_token = test_users["other_token"]
    doctor_token = test_users["doctor_token"]
    
    # Non-author cannot delete
    res_forbidden = await client.delete(
        f"/api/v1/posts/{post_id}",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert res_forbidden.status_code == 403
    
    # Author can delete
    res_delete = await client.delete(
        f"/api/v1/posts/{post_id}",
        headers={"Authorization": f"Bearer {doctor_token}"},
    )
    assert res_delete.status_code == 204
    
    # Verify post is gone
    res_get = await client.get(f"/api/v1/posts/{post_id}")
    assert res_get.status_code == 404
