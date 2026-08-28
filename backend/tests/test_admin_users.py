import pytest
from httpx import AsyncClient
from app.models.user import UserRole

@pytest.mark.asyncio
async def test_admin_list_users_search_filter_and_counts(client: AsyncClient, test_users, seed_data):
    admin_token = test_users["admin_token"]
    mod_token = test_users["moderator_token"]
    user_token = test_users["user_token"]

    # 1. Regular user forbidden (403)
    res_forbidden = await client.get(
        "/api/v1/admin/users",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert res_forbidden.status_code == 403

    # 2. Moderator allowed (200)
    res_mod = await client.get(
        "/api/v1/admin/users",
        headers={"Authorization": f"Bearer {mod_token}"},
    )
    assert res_mod.status_code == 200

    # 3. Admin search by username
    res_search = await client.get(
        "/api/v1/admin/users?search=drtest",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res_search.status_code == 200
    search_data = res_search.json()
    assert search_data["total"] >= 1
    assert any(u["username"] == "drtest" for u in search_data["items"])
    assert "post_count" in search_data["items"][0]
    assert "comment_count" in search_data["items"][0]

    # 4. Filter by role
    res_role = await client.get(
        "/api/v1/admin/users?role=doctor",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res_role.status_code == 200
    for u in res_role.json()["items"]:
        assert u["role"] == "doctor"


@pytest.mark.asyncio
async def test_admin_promote_user_role(client: AsyncClient, test_users):
    admin_token = test_users["admin_token"]
    user_id = str(test_users["user"].id)

    # Promote regular user to doctor
    res = await client.put(
        f"/api/v1/admin/users/{user_id}/role",
        json={"role": "doctor"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 200
    assert res.json()["role"] == "doctor"

    # Promote to moderator
    res_mod = await client.put(
        f"/api/v1/admin/users/{user_id}/role",
        json={"role": "moderator"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res_mod.status_code == 200
    assert res_mod.json()["role"] == "moderator"


@pytest.mark.asyncio
async def test_moderator_forbidden_from_role_and_ban_edits(client: AsyncClient, test_users):
    mod_token = test_users["moderator_token"]
    other_id = str(test_users["other"].id)

    # Moderator attempts role change -> 403
    res_role = await client.put(
        f"/api/v1/admin/users/{other_id}/role",
        json={"role": "doctor"},
        headers={"Authorization": f"Bearer {mod_token}"},
    )
    assert res_role.status_code == 403

    # Moderator attempts status change -> 403
    res_status = await client.put(
        f"/api/v1/admin/users/{other_id}/status",
        json={"is_active": False},
        headers={"Authorization": f"Bearer {mod_token}"},
    )
    assert res_status.status_code == 403


@pytest.mark.asyncio
async def test_admin_cannot_demote_or_ban_self(client: AsyncClient, test_users):
    admin_token = test_users["admin_token"]
    admin_id = str(test_users["admin"].id)

    # Admin attempts self demotion -> 400
    res_demote = await client.put(
        f"/api/v1/admin/users/{admin_id}/role",
        json={"role": "user"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res_demote.status_code == 400
    assert "Cannot modify your own administrative role" in res_demote.json()["detail"]

    # Admin attempts self deactivation -> 400
    res_ban = await client.put(
        f"/api/v1/admin/users/{admin_id}/status",
        json={"is_active": False},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res_ban.status_code == 400
    assert "Cannot deactivate your own account" in res_ban.json()["detail"]


@pytest.mark.asyncio
async def test_admin_deactivate_and_reactivate_user(client: AsyncClient, test_users):
    admin_token = test_users["admin_token"]
    other_token = test_users["other_token"]
    other_id = str(test_users["other"].id)

    # 1. Admin deactivates user
    res_deact = await client.put(
        f"/api/v1/admin/users/{other_id}/status",
        json={"is_active": False},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res_deact.status_code == 200
    assert res_deact.json()["is_active"] is False

    # 2. Deactivated user blocked from authenticated actions (403 Inactive user)
    res_action = await client.post(
        "/api/v1/posts",
        json={"title": "Post by banned user", "content": "<p>Content</p>"},
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert res_action.status_code == 403
    assert "Inactive user" in res_action.json()["detail"]

    # 3. Admin reactivates user
    res_react = await client.put(
        f"/api/v1/admin/users/{other_id}/status",
        json={"is_active": True},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res_react.status_code == 200
    assert res_react.json()["is_active"] is True

    # 4. User can make requests again
    res_action2 = await client.post(
        "/api/v1/posts",
        json={"title": "Post by unbanned user", "content": "<p>Content</p>"},
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert res_action2.status_code == 201
