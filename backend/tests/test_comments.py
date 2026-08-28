import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_comments_tree_and_nested_replies(client: AsyncClient, test_users, seed_data):
    post_id = str(seed_data["post1"].id)
    user_token = test_users["user_token"]
    doctor_token = test_users["doctor_token"]
    
    # 1. User creates root comment
    res1 = await client.post(
        f"/api/v1/posts/{post_id}/comments",
        json={"content": "Bác sĩ cho em hỏi nếu bé sốt 39 độ thì chườm ấm thế nào ạ?"},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert res1.status_code == 201
    root_comment = res1.json()
    root_id = root_comment["id"]
    assert root_comment["content"] == "Bác sĩ cho em hỏi nếu bé sốt 39 độ thì chườm ấm thế nào ạ?"
    assert root_comment["parent_id"] is None
    
    # 2. Doctor replies to root comment (Depth 1)
    res2 = await client.post(
        f"/api/v1/posts/{post_id}/comments",
        json={
            "content": "Chào bạn, bạn nên dùng nước ấm khoảng 37-38 độ, lau ở nách, bẹn và trán nhé.",
            "parent_id": root_id,
        },
        headers={"Authorization": f"Bearer {doctor_token}"},
    )
    assert res2.status_code == 201
    reply1 = res2.json()
    reply1_id = reply1["id"]
    assert reply1["parent_id"] == root_id
    
    # 3. User replies to doctor's reply (Depth 2)
    res3 = await client.post(
        f"/api/v1/posts/{post_id}/comments",
        json={
            "content": "Dạ em cảm ơn bác sĩ nhiều ạ!",
            "parent_id": reply1_id,
        },
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert res3.status_code == 201
    reply2 = res3.json()
    assert reply2["parent_id"] == reply1_id
    
    # 4. Fetch tree
    res_tree = await client.get(f"/api/v1/posts/{post_id}/comments")
    assert res_tree.status_code == 200
    tree = res_tree.json()
    
    # Verify hierarchical structure
    assert len(tree) == 1
    assert tree[0]["id"] == root_id
    assert len(tree[0]["replies"]) == 1
    assert tree[0]["replies"][0]["id"] == reply1_id
    assert len(tree[0]["replies"][0]["replies"]) == 1
    assert tree[0]["replies"][0]["replies"][0]["id"] == reply2["id"]

@pytest.mark.asyncio
async def test_comment_tombstone_deletion(client: AsyncClient, test_users, seed_data):
    post_id = str(seed_data["post1"].id)
    user_token = test_users["user_token"]
    doctor_token = test_users["doctor_token"]
    
    # Create parent comment
    res_parent = await client.post(
        f"/api/v1/posts/{post_id}/comments",
        json={"content": "Bình luận gốc sẽ bị xóa"},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    parent_id = res_parent.json()["id"]
    
    # Create child reply
    await client.post(
        f"/api/v1/posts/{post_id}/comments",
        json={"content": "Phản hồi con của bình luận gốc", "parent_id": parent_id},
        headers={"Authorization": f"Bearer {doctor_token}"},
    )
    
    # Delete parent comment (should become tombstone because child exists)
    res_del = await client.delete(
        f"/api/v1/comments/{parent_id}",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert res_del.status_code == 204
    
    # Fetch tree and verify tombstone content
    res_tree = await client.get(f"/api/v1/posts/{post_id}/comments")
    tree = res_tree.json()
    assert len(tree) == 1
    assert tree[0]["is_deleted"] is True
    assert tree[0]["content"] == "[Bình luận đã bị xóa]"
    assert len(tree[0]["replies"]) == 1
    assert tree[0]["replies"][0]["content"] == "Phản hồi con của bình luận gốc"
