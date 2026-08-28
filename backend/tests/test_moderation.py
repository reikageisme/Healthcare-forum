import pytest
from httpx import AsyncClient
from app.models.post import PostStatus

@pytest.mark.asyncio
async def test_user_post_created_as_pending(client: AsyncClient, test_users, seed_data):
    token = test_users["user_token"]
    cat_id = str(seed_data["cat1"].id)

    payload = {
        "title": "Câu hỏi từ người dùng thông thường",
        "content": "<p>Tôi cần tư vấn triệu chứng đau đầu nhẹ sau khi thức dậy.</p>",
        "post_type": "question",
        "category_id": cat_id,
        "tags": ["Đau đầu"],
    }
    res = await client.post(
        "/api/v1/posts",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "pending"
    assert data["rejection_reason"] is None


@pytest.mark.asyncio
async def test_doctor_and_staff_posts_auto_approved(client: AsyncClient, test_users, seed_data):
    cat_id = str(seed_data["cat1"].id)

    # Doctor post -> approved
    res_doc = await client.post(
        "/api/v1/posts",
        json={
            "title": "Bài viết chuyên khoa từ Bác sĩ",
            "content": "<p>Hướng dẫn chăm sóc sức khỏe tim mạch định kỳ.</p>",
            "post_type": "article",
            "category_id": cat_id,
        },
        headers={"Authorization": f"Bearer {test_users['doctor_token']}"},
    )
    assert res_doc.status_code == 201
    assert res_doc.json()["status"] == "approved"

    # Moderator post -> approved
    res_mod = await client.post(
        "/api/v1/posts",
        json={
            "title": "Thông báo nội quy diễn đàn từ Kiểm duyệt viên",
            "content": "<p>Nội quy thảo luận văn minh trên diễn đàn.</p>",
            "post_type": "share",
        },
        headers={"Authorization": f"Bearer {test_users['moderator_token']}"},
    )
    assert res_mod.status_code == 201
    assert res_mod.json()["status"] == "approved"

    # Admin post -> approved
    res_admin = await client.post(
        "/api/v1/posts",
        json={
            "title": "Thông báo cập nhật hệ thống từ Quản trị viên",
            "content": "<p>Hệ thống nâng cấp tính năng mới.</p>",
            "post_type": "share",
        },
        headers={"Authorization": f"Bearer {test_users['admin_token']}"},
    )
    assert res_admin.status_code == 201
    assert res_admin.json()["status"] == "approved"


@pytest.mark.asyncio
async def test_public_feed_excludes_pending_and_rejected_posts(client: AsyncClient, test_users, seed_data):
    # 1. User creates pending post
    res_pending = await client.post(
        "/api/v1/posts",
        json={"title": "Pending Post User 1", "content": "<p>Pending Content</p>"},
        headers={"Authorization": f"Bearer {test_users['user_token']}"},
    )
    assert res_pending.status_code == 201
    pending_id = res_pending.json()["id"]

    # 2. Public feed request
    res_feed = await client.get("/api/v1/posts")
    assert res_feed.status_code == 200
    feed_items = res_feed.json()["items"]
    feed_ids = [item["id"] for item in feed_items]

    # Pending post should not be in public feed
    assert pending_id not in feed_ids
    for item in feed_items:
        assert item["status"] == "approved"


@pytest.mark.asyncio
async def test_post_detail_visibility_by_role(client: AsyncClient, test_users, seed_data):
    # User creates pending post
    res_pending = await client.post(
        "/api/v1/posts",
        json={"title": "Private Pending Post", "content": "<p>Private Content</p>"},
        headers={"Authorization": f"Bearer {test_users['user_token']}"},
    )
    pending_id = res_pending.json()["id"]

    # Author can view own pending post (200)
    res_author = await client.get(
        f"/api/v1/posts/{pending_id}",
        headers={"Authorization": f"Bearer {test_users['user_token']}"},
    )
    assert res_author.status_code == 200
    assert res_author.json()["status"] == "pending"

    # Moderator can view pending post (200)
    res_mod = await client.get(
        f"/api/v1/posts/{pending_id}",
        headers={"Authorization": f"Bearer {test_users['moderator_token']}"},
    )
    assert res_mod.status_code == 200

    # Admin can view pending post (200)
    res_admin = await client.get(
        f"/api/v1/posts/{pending_id}",
        headers={"Authorization": f"Bearer {test_users['admin_token']}"},
    )
    assert res_admin.status_code == 200

    # Stranger (other user) cannot view pending post (404)
    res_stranger = await client.get(
        f"/api/v1/posts/{pending_id}",
        headers={"Authorization": f"Bearer {test_users['other_token']}"},
    )
    assert res_stranger.status_code == 404

    # Anonymous unauthenticated guest cannot view pending post (404)
    res_guest = await client.get(f"/api/v1/posts/{pending_id}")
    assert res_guest.status_code == 404


@pytest.mark.asyncio
async def test_moderation_queue_list_and_rbac(client: AsyncClient, test_users, seed_data):
    # Create 2 pending posts
    await client.post(
        "/api/v1/posts",
        json={"title": "Queue Post 1", "content": "<p>Queue 1</p>"},
        headers={"Authorization": f"Bearer {test_users['user_token']}"},
    )
    await client.post(
        "/api/v1/posts",
        json={"title": "Queue Post 2", "content": "<p>Queue 2</p>"},
        headers={"Authorization": f"Bearer {test_users['other_token']}"},
    )

    # 1. Unauthenticated -> 401
    res_unauth = await client.get("/api/v1/admin/moderation/posts")
    assert res_unauth.status_code == 401

    # 2. Regular user -> 403
    res_user = await client.get(
        "/api/v1/admin/moderation/posts",
        headers={"Authorization": f"Bearer {test_users['user_token']}"},
    )
    assert res_user.status_code == 403

    # 3. Doctor -> 403
    res_doc = await client.get(
        "/api/v1/admin/moderation/posts",
        headers={"Authorization": f"Bearer {test_users['doctor_token']}"},
    )
    assert res_doc.status_code == 403

    # 4. Moderator -> 200
    res_mod = await client.get(
        "/api/v1/admin/moderation/posts?status=pending",
        headers={"Authorization": f"Bearer {test_users['moderator_token']}"},
    )
    assert res_mod.status_code == 200
    data = res_mod.json()
    assert data["total"] >= 2
    for item in data["items"]:
        assert item["status"] == "pending"


@pytest.mark.asyncio
async def test_moderation_approve_workflow(client: AsyncClient, test_users, seed_data):
    # User creates pending post
    res_post = await client.post(
        "/api/v1/posts",
        json={"title": "Pending Post to Approve", "content": "<p>To be approved</p>"},
        headers={"Authorization": f"Bearer {test_users['user_token']}"},
    )
    post_id = res_post.json()["id"]

    # Moderator approves post via /approve
    res_approve = await client.post(
        f"/api/v1/admin/moderation/posts/{post_id}/approve",
        headers={"Authorization": f"Bearer {test_users['moderator_token']}"},
    )
    assert res_approve.status_code == 200
    assert res_approve.json()["status"] == "approved"

    # Verify post now appears in public feed
    res_feed = await client.get("/api/v1/posts")
    assert res_feed.status_code == 200
    feed_ids = [p["id"] for p in res_feed.json()["items"]]
    assert post_id in feed_ids


@pytest.mark.asyncio
async def test_moderation_reject_workflow(client: AsyncClient, test_users, seed_data):
    # User creates pending post
    res_post = await client.post(
        "/api/v1/posts",
        json={"title": "Spam Post to Reject", "content": "<p>Mua thuốc không rõ nguồn gốc...</p>"},
        headers={"Authorization": f"Bearer {test_users['user_token']}"},
    )
    post_id = res_post.json()["id"]

    # Moderator rejects post with reason
    rejection_reason = "Bài viết quảng cáo thuốc không có giấy phép lưu hành."
    res_reject = await client.post(
        f"/api/v1/admin/moderation/posts/{post_id}/reject",
        json={"reason": rejection_reason},
        headers={"Authorization": f"Bearer {test_users['moderator_token']}"},
    )
    assert res_reject.status_code == 200
    data = res_reject.json()
    assert data["status"] == "rejected"
    assert data["rejection_reason"] == rejection_reason

    # Author can view rejected post and see rejection reason
    res_author = await client.get(
        f"/api/v1/posts/{post_id}",
        headers={"Authorization": f"Bearer {test_users['user_token']}"},
    )
    assert res_author.status_code == 200
    assert res_author.json()["status"] == "rejected"
    assert res_author.json()["rejection_reason"] == rejection_reason

    # Stranger cannot view rejected post (404)
    res_stranger = await client.get(
        f"/api/v1/posts/{post_id}",
        headers={"Authorization": f"Bearer {test_users['other_token']}"},
    )
    assert res_stranger.status_code == 404
