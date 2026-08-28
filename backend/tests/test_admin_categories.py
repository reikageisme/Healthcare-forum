import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_admin_and_mod_update_category(client: AsyncClient, test_users, seed_data):
    cat1_id = str(seed_data["cat1"].id)
    user_token = test_users["user_token"]
    mod_token = test_users["moderator_token"]
    admin_token = test_users["admin_token"]

    # 1. Regular user cannot update category (403)
    res_user = await client.put(
        f"/api/v1/categories/{cat1_id}",
        json={"name": "Nhi khoa cập nhật bởi user"},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert res_user.status_code == 403

    # 2. Moderator can update category (200)
    res_mod = await client.put(
        f"/api/v1/categories/{cat1_id}",
        json={"name": "Nhi khoa & Sơ sinh", "icon": "BabyIcon", "description": "Chăm sóc toàn diện cho trẻ sơ sinh và trẻ nhỏ"},
        headers={"Authorization": f"Bearer {mod_token}"},
    )
    assert res_mod.status_code == 200
    mod_data = res_mod.json()
    assert mod_data["name"] == "Nhi khoa & Sơ sinh"
    assert mod_data["icon"] == "BabyIcon"

    # 3. Admin can update category (200)
    res_admin = await client.put(
        f"/api/v1/categories/{cat1_id}",
        json={"name": "Nhi khoa Toàn diện", "icon": "HeartBaby"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res_admin.status_code == 200
    assert res_admin.json()["name"] == "Nhi khoa Toàn diện"


@pytest.mark.asyncio
async def test_admin_delete_category_rbac_and_post_nulling(client: AsyncClient, test_users, seed_data):
    cat_id = str(seed_data["cat2"].id)
    user_token = test_users["user_token"]
    mod_token = test_users["moderator_token"]
    admin_token = test_users["admin_token"]

    # 1. Regular user cannot delete (403)
    res_user = await client.delete(
        f"/api/v1/categories/{cat_id}",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert res_user.status_code == 403

    # 2. Moderator cannot delete (403 - Admin only)
    res_mod = await client.delete(
        f"/api/v1/categories/{cat_id}",
        headers={"Authorization": f"Bearer {mod_token}"},
    )
    assert res_mod.status_code == 403

    # 3. Admin can delete category (204)
    res_admin = await client.delete(
        f"/api/v1/categories/{cat_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res_admin.status_code == 204

    # 4. Verify category is deleted (404)
    res_get = await client.get(f"/api/v1/categories/{cat_id}")
    assert res_get.status_code == 404
