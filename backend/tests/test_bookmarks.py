import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_bookmark_toggle_and_retrieval(client: AsyncClient, test_users, seed_data):
    post_id = str(seed_data["post1"].id)
    user_token = test_users["user_token"]
    
    # 1. Bookmark post (Saved = True)
    res1 = await client.post(
        f"/api/v1/posts/{post_id}/bookmark",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert res1.status_code == 200
    assert res1.json()["is_bookmarked"] is True
    
    # 2. Check saved posts list
    res_list = await client.get(
        "/api/v1/users/me/bookmarks",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert res_list.status_code == 200
    data_list = res_list.json()
    assert len(data_list["items"]) == 1
    assert data_list["items"][0]["id"] == post_id
    assert data_list["items"][0]["is_bookmarked"] is True
    
    # 3. Toggle bookmark again (Saved = False)
    res2 = await client.post(
        f"/api/v1/posts/{post_id}/bookmark",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert res2.status_code == 200
    assert res2.json()["is_bookmarked"] is False
    
    # 4. Check list is now empty
    res_list_empty = await client.get(
        "/api/v1/users/me/bookmarks",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert res_list_empty.status_code == 200
    assert len(res_list_empty.json()["items"]) == 0
