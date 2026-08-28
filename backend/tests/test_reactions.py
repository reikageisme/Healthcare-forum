import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_reaction_tri_state_toggle_and_counts(client: AsyncClient, test_users, seed_data):
    post_id = str(seed_data["post1"].id)
    user_token = test_users["user_token"]
    
    # 1. User reacts "helpful" (Action: added)
    res1 = await client.post(
        f"/api/v1/posts/{post_id}/reactions",
        json={"reaction_type": "helpful"},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["action"] == "added"
    assert data1["current_reaction"] == "helpful"
    assert data1["counts"]["helpful"] == 1
    assert data1["counts"]["total"] == 1
    
    # 2. User reacts "helpful" again (Action: removed / unreact)
    res2 = await client.post(
        f"/api/v1/posts/{post_id}/reactions",
        json={"reaction_type": "helpful"},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["action"] == "removed"
    assert data2["current_reaction"] is None
    assert data2["counts"]["helpful"] == 0
    assert data2["counts"]["total"] == 0
    
    # 3. User reacts "helpful", then switches to "like" (Action: updated)
    await client.post(
        f"/api/v1/posts/{post_id}/reactions",
        json={"reaction_type": "helpful"},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    res3 = await client.post(
        f"/api/v1/posts/{post_id}/reactions",
        json={"reaction_type": "like"},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert res3.status_code == 200
    data3 = res3.json()
    assert data3["action"] == "updated"
    assert data3["current_reaction"] == "like"
    assert data3["counts"]["helpful"] == 0
    assert data3["counts"]["like"] == 1
    assert data3["counts"]["total"] == 1
