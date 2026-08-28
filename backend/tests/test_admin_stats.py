import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_admin_stats_rbac(client: AsyncClient, test_users):
    # 1. Unauthenticated -> 401
    res_unauth = await client.get("/api/v1/admin/stats")
    assert res_unauth.status_code == 401

    # 2. Regular user -> 403
    res_user = await client.get(
        "/api/v1/admin/stats",
        headers={"Authorization": f"Bearer {test_users['user_token']}"},
    )
    assert res_user.status_code == 403

    # 3. Doctor -> 403
    res_doc = await client.get(
        "/api/v1/admin/stats",
        headers={"Authorization": f"Bearer {test_users['doctor_token']}"},
    )
    assert res_doc.status_code == 403

    # 4. Moderator -> 200
    res_mod = await client.get(
        "/api/v1/admin/stats",
        headers={"Authorization": f"Bearer {test_users['moderator_token']}"},
    )
    assert res_mod.status_code == 200

    # 5. Admin -> 200
    res_admin = await client.get(
        "/api/v1/admin/stats",
        headers={"Authorization": f"Bearer {test_users['admin_token']}"},
    )
    assert res_admin.status_code == 200


@pytest.mark.asyncio
async def test_admin_stats_overview_and_zero_filling(client: AsyncClient, test_users, seed_data):
    admin_token = test_users["admin_token"]

    # Request 30-day stats
    res = await client.get(
        "/api/v1/admin/stats?days=30",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 200
    data = res.json()

    # Verify overview totals structure
    overview = data["overview"]
    assert overview["total_users"] >= 4
    assert overview["total_posts"] >= 1
    assert overview["total_categories"] >= 2
    assert overview["total_doctors"] >= 1

    # Verify time series
    time_series = data["time_series"]
    assert len(time_series) == 30

    # Verify chronological ascending order
    dates = [pt["date"] for pt in time_series]
    assert dates == sorted(dates)

    # Verify structure of daily data points
    for pt in time_series:
        assert "date" in pt
        assert "new_users" in pt
        assert "new_posts" in pt
        assert "new_comments" in pt
        assert isinstance(pt["new_users"], int)
        assert isinstance(pt["new_posts"], int)
        assert isinstance(pt["new_comments"], int)
