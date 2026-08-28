import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_hot_tags_and_search(client: AsyncClient, test_users, seed_data):
    # Hot tags endpoint
    res_hot = await client.get("/api/v1/tags/hot?limit=5")
    assert res_hot.status_code == 200
    hot_tags = res_hot.json()
    assert len(hot_tags) >= 1
    # Check that post_count is present
    assert "post_count" in hot_tags[0]
    
    # Tag search endpoint
    res_search = await client.get("/api/v1/tags/search?q=sot")
    assert res_search.status_code == 200
    search_tags = res_search.json()
    assert any("sot" in t["slug"] for t in search_tags)

@pytest.mark.asyncio
async def test_categories_listing_and_admin_creation(client: AsyncClient, test_users, seed_data):
    user_token = test_users["user_token"]
    admin_token = test_users["admin_token"]
    
    # List categories
    res_list = await client.get("/api/v1/categories")
    assert res_list.status_code == 200
    cats = res_list.json()
    assert len(cats) >= 2
    assert "post_count" in cats[0]
    
    # Regular user cannot create category
    res_forbidden = await client.post(
        "/api/v1/categories",
        json={"name": "Tai mũi họng", "description": "Bệnh lý tai mũi họng"},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert res_forbidden.status_code == 403
    
    # Admin creates category
    res_create = await client.post(
        "/api/v1/categories",
        json={"name": "Tai mũi họng", "description": "Bệnh lý tai mũi họng", "icon": "Ear"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res_create.status_code == 201
    created_cat = res_create.json()
    assert created_cat["name"] == "Tai mũi họng"
    assert created_cat["slug"] == "tai-mui-hong"
