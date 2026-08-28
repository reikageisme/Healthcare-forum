import uuid
import pytest
from httpx import AsyncClient
from app.models.report import ReportStatus, ReportTargetType

@pytest.mark.asyncio
async def test_submit_report_on_post_and_comment(client: AsyncClient, test_users, seed_data):
    post_id = str(seed_data["post1"].id)
    user_token = test_users["user_token"]

    # 1. Create a comment to report
    res_com = await client.post(
        f"/api/v1/posts/{post_id}/comments",
        json={"content": "Bình luận chứa thông tin sai lệch"},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    comment_id = res_com.json()["id"]

    # 2. Report the post
    res_rep_post = await client.post(
        "/api/v1/reports",
        json={
            "target_type": "post",
            "target_id": post_id,
            "report_type": "misinformation",
            "reason": "Thông tin y tế chưa được chứng minh",
            "details": "Chi tiết về nguồn tài liệu không đáng tin cậy",
        },
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert res_rep_post.status_code == 201
    post_rep = res_rep_post.json()
    assert post_rep["target_type"] == "post"
    assert post_rep["status"] == "open"
    assert post_rep["target_id"] == post_id
    assert post_rep["reporter"]["username"] == "testuser"

    # 3. Report the comment
    res_rep_com = await client.post(
        "/api/v1/reports",
        json={
            "target_type": "comment",
            "target_id": comment_id,
            "report_type": "harassment",
            "reason": "Ngôn từ thô tục, xúc phạm người khác",
        },
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert res_rep_com.status_code == 201
    assert res_rep_com.json()["target_type"] == "comment"
    assert res_rep_com.json()["target_id"] == comment_id


@pytest.mark.asyncio
async def test_duplicate_report_prevention(client: AsyncClient, test_users, seed_data):
    post_id = str(seed_data["post1"].id)
    user_token = test_users["user_token"]

    # First report
    res1 = await client.post(
        "/api/v1/reports",
        json={
            "target_type": "post",
            "target_id": post_id,
            "reason": "Spam lần 1",
        },
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert res1.status_code == 201

    # Second report on same post by same user while open -> 400
    res2 = await client.post(
        "/api/v1/reports",
        json={
            "target_type": "post",
            "target_id": post_id,
            "reason": "Spam lần 2",
        },
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert res2.status_code == 400
    assert "already reported" in res2.json()["detail"]


@pytest.mark.asyncio
async def test_report_nonexistent_target(client: AsyncClient, test_users):
    user_token = test_users["user_token"]
    fake_id = str(uuid.uuid4())

    res = await client.post(
        "/api/v1/reports",
        json={
            "target_type": "post",
            "target_id": fake_id,
            "reason": "Target không tồn tại",
        },
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_admin_list_and_resolve_reports(client: AsyncClient, test_users, seed_data):
    post_id = str(seed_data["post1"].id)
    user_token = test_users["user_token"]
    mod_token = test_users["moderator_token"]

    # Submit report
    res_create = await client.post(
        "/api/v1/reports",
        json={
            "target_type": "post",
            "target_id": post_id,
            "reason": "Cần kiểm tra lại nội dung bài viết",
        },
        headers={"Authorization": f"Bearer {user_token}"},
    )
    report_id = res_create.json()["id"]

    # List reports as moderator
    res_list = await client.get(
        "/api/v1/admin/reports?status=open",
        headers={"Authorization": f"Bearer {mod_token}"},
    )
    assert res_list.status_code == 200
    data = res_list.json()
    assert data["total"] >= 1
    assert any(r["id"] == report_id for r in data["items"])

    # Resolve report
    res_resolve = await client.put(
        f"/api/v1/admin/reports/{report_id}",
        json={"status": "resolved", "resolution_notes": "Đã kiểm tra và bài viết hợp lệ."},
        headers={"Authorization": f"Bearer {mod_token}"},
    )
    assert res_resolve.status_code == 200
    res_data = res_resolve.json()
    assert res_data["status"] == "resolved"
    assert res_data["resolution_notes"] == "Đã kiểm tra và bài viết hợp lệ."
    assert res_data["resolved_by"] == str(test_users["moderator"].id)


@pytest.mark.asyncio
async def test_admin_delete_reported_content(client: AsyncClient, test_users, seed_data):
    post_id = str(seed_data["post1"].id)
    user_token = test_users["user_token"]
    admin_token = test_users["admin_token"]

    # Create comment
    res_com = await client.post(
        f"/api/v1/posts/{post_id}/comments",
        json={"content": "Bình luận vi phạm tiêu chuẩn nghiêm trọng"},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    comment_id = res_com.json()["id"]

    # Report the comment
    res_rep = await client.post(
        "/api/v1/reports",
        json={
            "target_type": "comment",
            "target_id": comment_id,
            "reason": "Vi phạm tiêu chuẩn",
        },
        headers={"Authorization": f"Bearer {user_token}"},
    )
    report_id = res_rep.json()["id"]

    # Admin deletes reported content
    res_del = await client.delete(
        f"/api/v1/admin/reports/{report_id}/content",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res_del.status_code == 200
    assert res_del.json()["success"] is True

    # Verify comment is tombstoned
    res_tree = await client.get(f"/api/v1/posts/{post_id}/comments")
    assert res_tree.status_code == 200
    tree = res_tree.json()
    assert any(c["id"] == comment_id and c["is_deleted"] is True for c in tree)

    # Verify report is resolved
    res_rep_check = await client.get(
        f"/api/v1/admin/reports?status=resolved",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res_rep_check.status_code == 200
    assert any(r["id"] == report_id for r in res_rep_check.json()["items"])
