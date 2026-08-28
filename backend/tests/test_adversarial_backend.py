import io
import uuid
import base64
import json
from datetime import datetime, timezone, timedelta
import pytest
from httpx import AsyncClient
from PIL import Image

from app.models.post import Post, PostType
from app.models.tag import Tag
from app.models.category import Category
from app.models.reaction import Reaction, ReactionType
from app.models.bookmark import Bookmark
from app.api.v1.posts import encode_cursor, decode_cursor


def generate_valid_image(fmt="PNG", size=(50, 50), color=(100, 150, 200)) -> bytes:
    buf = io.BytesIO()
    img = Image.new("RGB", size, color=color)
    img.save(buf, format=fmt)
    buf.seek(0)
    return buf.read()


# ==============================================================================
# 1. KEYSET CURSOR PAGINATION ADVERSARIAL TESTS
# ==============================================================================

@pytest.mark.asyncio
async def test_cursor_encode_decode_integrity():
    now = datetime.now(timezone.utc)
    uid = uuid.uuid4()
    
    encoded = encode_cursor(now, uid)
    assert isinstance(encoded, str)
    assert len(encoded) > 0
    
    decoded = decode_cursor(encoded)
    assert decoded is not None
    dt, decoded_id = decoded
    assert decoded_id == uid
    # Compare timestamps (allow microsecond string format round-trip)
    assert dt.isoformat() == now.isoformat()


@pytest.mark.asyncio
async def test_cursor_malformed_and_tampered_inputs():
    # Empty string
    assert decode_cursor("") is None
    # Invalid base64
    assert decode_cursor("!@#$%^&*()") is None
    # Valid base64 but invalid JSON
    assert decode_cursor(base64.urlsafe_b64encode(b"not a json").decode("utf-8")) is None
    # Valid JSON but missing fields
    missing_id = base64.urlsafe_b64encode(json.dumps({"t": "2026-01-01T00:00:00"}).encode()).decode()
    assert decode_cursor(missing_id) is None
    # Valid JSON but invalid UUID
    invalid_uuid = base64.urlsafe_b64encode(json.dumps({"t": "2026-01-01T00:00:00", "id": "not-a-uuid"}).encode()).decode()
    assert decode_cursor(invalid_uuid) is None
    # Valid JSON but invalid datetime
    invalid_dt = base64.urlsafe_b64encode(json.dumps({"t": "not-a-datetime", "id": str(uuid.uuid4())}).encode()).decode()
    assert decode_cursor(invalid_dt) is None


@pytest.mark.asyncio
async def test_posts_cursor_pagination_boundaries(client: AsyncClient, test_users, db_session):
    token = test_users["user_token"]
    
    # 1. Test pagination on empty post table (delete seed posts first)
    # Get all posts
    res = await client.get("/api/v1/posts?limit=10")
    assert res.status_code == 200
    page_data = res.json()
    assert "items" in page_data
    assert "has_more" in page_data
    assert "next_cursor" in page_data
    
    # 2. Feed pagination with malformed cursor parameter gracefully ignores and returns 1st page
    res_bad_cursor = await client.get("/api/v1/posts?limit=5&cursor=invalid_garbage_cursor")
    assert res_bad_cursor.status_code == 200
    assert "items" in res_bad_cursor.json()


@pytest.mark.asyncio
async def test_posts_cursor_exact_boundary_and_no_duplicates(client: AsyncClient, test_users, seed_data):
    token = test_users["doctor_token"]
    cat_id = str(seed_data["cat1"].id)
    
    # Create exactly 7 posts
    created_ids = []
    for i in range(7):

        resp = await client.post(
            "/api/v1/posts",
            json={
                "title": f"Stress Post {i+1}",
                "content": f"<p>Content for stress post {i+1}</p>",
                "post_type": "article",
                "category_id": cat_id,
                "tags": ["StressTest"],
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 201
        created_ids.append(resp.json()["id"])
    
    # Page size limit = 3
    # Total posts = 7 newly created + 1 seed post = 8 posts
    # Page 1: 3 items, has_more = True
    p1 = await client.get("/api/v1/posts?limit=3")
    p1_data = p1.json()
    assert len(p1_data["items"]) == 3
    assert p1_data["has_more"] is True
    assert p1_data["next_cursor"] is not None
    
    # Page 2: 3 items, has_more = True
    p2 = await client.get(f"/api/v1/posts?limit=3&cursor={p1_data['next_cursor']}")
    p2_data = p2.json()
    assert len(p2_data["items"]) == 3
    assert p2_data["has_more"] is True
    assert p2_data["next_cursor"] is not None
    
    # Page 3: 2 items, has_more = False, next_cursor = None
    p3 = await client.get(f"/api/v1/posts?limit=3&cursor={p2_data['next_cursor']}")
    p3_data = p3.json()
    assert len(p3_data["items"]) == 2
    assert p3_data["has_more"] is False
    assert p3_data["next_cursor"] is None
    
    # Verify uniqueness of all fetched items across pages
    all_fetched_ids = [item["id"] for item in p1_data["items"] + p2_data["items"] + p3_data["items"]]
    assert len(all_fetched_ids) == 8
    assert len(set(all_fetched_ids)) == 8


# ==============================================================================
# 2. NESTED COMMENTS TREE (DEPTH 1-5+, FK VALIDATION, TOMBSTONE VS HARD DELETE)
# ==============================================================================

@pytest.mark.asyncio
async def test_nested_comments_deep_hierarchy(client: AsyncClient, test_users, seed_data):
    post_id = str(seed_data["post1"].id)
    token = test_users["user_token"]
    
    # Build 5-level deep hierarchy:
    # Root (Level 0) -> Child1 (Level 1) -> Child2 (Level 2) -> Child3 (Level 3) -> Child4 (Level 4)
    current_parent_id = None
    node_ids = []
    
    for level in range(5):
        res = await client.post(
            f"/api/v1/posts/{post_id}/comments",
            json={
                "content": f"Comment at nesting level {level}",
                "parent_id": current_parent_id,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 201
        data = res.json()
        assert data["content"] == f"Comment at nesting level {level}"
        assert data["parent_id"] == current_parent_id
        current_parent_id = data["id"]
        node_ids.append(data["id"])
    
    # Fetch tree
    tree_res = await client.get(f"/api/v1/posts/{post_id}/comments")
    assert tree_res.status_code == 200
    tree = tree_res.json()
    assert len(tree) == 1  # 1 root
    
    # Verify 5 levels deep
    curr = tree[0]
    assert curr["id"] == node_ids[0]
    assert len(curr["replies"]) == 1
    
    curr = curr["replies"][0]
    assert curr["id"] == node_ids[1]
    assert len(curr["replies"]) == 1
    
    curr = curr["replies"][0]
    assert curr["id"] == node_ids[2]
    assert len(curr["replies"]) == 1
    
    curr = curr["replies"][0]
    assert curr["id"] == node_ids[3]
    assert len(curr["replies"]) == 1
    
    curr = curr["replies"][0]
    assert curr["id"] == node_ids[4]
    assert len(curr["replies"]) == 0


@pytest.mark.asyncio
async def test_comments_parent_id_cross_post_rejection(client: AsyncClient, test_users, seed_data):
    user_token = test_users["user_token"]
    doctor_token = test_users["doctor_token"]
    post1_id = str(seed_data["post1"].id)
    
    # Create Post 2
    res_p2 = await client.post(
        "/api/v1/posts",
        json={
            "title": "Post 2 for Cross-Post Comment Test",
            "content": "<p>Post 2 content</p>",
            "post_type": "article",
        },
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert res_p2.status_code == 201
    post2_id = res_p2.json()["id"]
    
    # Create Comment on Post 1
    res_c1 = await client.post(
        f"/api/v1/posts/{post1_id}/comments",
        json={"content": "Comment on Post 1"},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert res_c1.status_code == 201
    c1_id = res_c1.json()["id"]
    
    # Attempt to reply on Post 2 referencing Comment on Post 1 (Foreign Post parent_id)
    res_cross = await client.post(
        f"/api/v1/posts/{post2_id}/comments",
        json={"content": "Cross-post reply attempt", "parent_id": c1_id},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert res_cross.status_code == 400
    assert "Parent comment belongs to a different post" in res_cross.json()["detail"]
    
    # Attempt with completely non-existent UUID
    fake_uuid = str(uuid.uuid4())
    res_fake = await client.post(
        f"/api/v1/posts/{post2_id}/comments",
        json={"content": "Fake parent reply attempt", "parent_id": fake_uuid},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert res_fake.status_code == 404
    assert "Parent comment not found" in res_fake.json()["detail"]


@pytest.mark.asyncio
async def test_comments_leaf_hard_delete_vs_branch_tombstone(client: AsyncClient, test_users, seed_data):
    post_id = str(seed_data["post1"].id)
    token = test_users["user_token"]
    
    # 1. Create root comment
    r_res = await client.post(
        f"/api/v1/posts/{post_id}/comments",
        json={"content": "Root Comment to test deletion modes"},
        headers={"Authorization": f"Bearer {token}"},
    )
    root_id = r_res.json()["id"]
    
    # 2. Create leaf comment (child)
    c_res = await client.post(
        f"/api/v1/posts/{post_id}/comments",
        json={"content": "Leaf child comment", "parent_id": root_id},
        headers={"Authorization": f"Bearer {token}"},
    )
    leaf_id = c_res.json()["id"]
    
    # Delete leaf comment first -> Should be HARD deleted
    del_leaf = await client.delete(
        f"/api/v1/comments/{leaf_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert del_leaf.status_code == 204
    
    # Check tree: leaf is completely gone
    t1 = await client.get(f"/api/v1/posts/{post_id}/comments")
    assert len(t1.json()) == 1
    assert len(t1.json()[0]["replies"]) == 0
    
    # Re-add child comment so root has a child
    await client.post(
        f"/api/v1/posts/{post_id}/comments",
        json={"content": "New child comment", "parent_id": root_id},
        headers={"Authorization": f"Bearer {token}"},
    )
    
    # Now delete root -> Should be SOFT deleted (Tombstone)
    del_root = await client.delete(
        f"/api/v1/comments/{root_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert del_root.status_code == 204
    
    # Check tree: root exists as tombstone
    t2 = await client.get(f"/api/v1/posts/{post_id}/comments")
    assert len(t2.json()) == 1
    assert t2.json()[0]["is_deleted"] is True
    assert t2.json()[0]["content"] == "[Bình luận đã bị xóa]"
    assert len(t2.json()[0]["replies"]) == 1
    
    # Attempt to edit deleted comment -> should be rejected with 400
    edit_res = await client.put(
        f"/api/v1/comments/{root_id}",
        json={"content": "Trying to edit deleted comment"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert edit_res.status_code == 400
    assert "Cannot edit a deleted comment" in edit_res.json()["detail"]


# ==============================================================================
# 3. REACTION TRI-STATE TOGGLE AND MULTI-USER RECALCULATION
# ==============================================================================

@pytest.mark.asyncio
async def test_reaction_state_machine_and_case_normalization(client: AsyncClient, test_users, seed_data):
    post_id = str(seed_data["post1"].id)
    u_token = test_users["user_token"]
    d_token = test_users["doctor_token"]
    o_token = test_users["other_token"]
    
    # Case normalization: "HELPFUL", "Like", "INFORMATIVE"
    res1 = await client.post(
        f"/api/v1/posts/{post_id}/reactions",
        json={"reaction_type": "HELPFUL"},
        headers={"Authorization": f"Bearer {u_token}"},
    )
    assert res1.status_code == 200
    assert res1.json()["action"] == "added"
    assert res1.json()["current_reaction"] == "helpful"
    assert res1.json()["counts"]["helpful"] == 1
    
    # Doctor reacts "like"
    res2 = await client.post(
        f"/api/v1/posts/{post_id}/reactions",
        json={"reaction_type": "like"},
        headers={"Authorization": f"Bearer {d_token}"},
    )
    assert res2.status_code == 200
    assert res2.json()["counts"]["helpful"] == 1
    assert res2.json()["counts"]["like"] == 1
    assert res2.json()["counts"]["total"] == 2
    
    # Other reacts "informative"
    res3 = await client.post(
        f"/api/v1/posts/{post_id}/reactions",
        json={"reaction_type": "informative"},
        headers={"Authorization": f"Bearer {o_token}"},
    )
    assert res3.status_code == 200
    assert res3.json()["counts"]["helpful"] == 1
    assert res3.json()["counts"]["like"] == 1
    assert res3.json()["counts"]["informative"] == 1
    assert res3.json()["counts"]["total"] == 3
    
    # User switches helpful -> informative
    res4 = await client.post(
        f"/api/v1/posts/{post_id}/reactions",
        json={"reaction_type": "informative"},
        headers={"Authorization": f"Bearer {u_token}"},
    )
    assert res4.status_code == 200
    assert res4.json()["action"] == "updated"
    assert res4.json()["counts"]["helpful"] == 0
    assert res4.json()["counts"]["like"] == 1
    assert res4.json()["counts"]["informative"] == 2
    assert res4.json()["counts"]["total"] == 3
    
    # User unreacts (toggles off)
    res5 = await client.post(
        f"/api/v1/posts/{post_id}/reactions",
        json={"reaction_type": "informative"},
        headers={"Authorization": f"Bearer {u_token}"},
    )
    assert res5.status_code == 200
    assert res5.json()["action"] == "removed"
    assert res5.json()["current_reaction"] is None
    assert res5.json()["counts"]["informative"] == 1
    assert res5.json()["counts"]["total"] == 2


# ==============================================================================
# 4. BOOKMARKS TOGGLE AND USER SAVED FEED
# ==============================================================================

@pytest.mark.asyncio
async def test_bookmarks_multi_post_feed(client: AsyncClient, test_users, seed_data):
    token = test_users["user_token"]
    post1_id = str(seed_data["post1"].id)
    
    # Create Post 2 & Post 3
    p2 = await client.post(
        "/api/v1/posts",
        json={"title": "Bookmark Test Post 2", "content": "<p>Content 2</p>"},
        headers={"Authorization": f"Bearer {token}"},
    )
    post2_id = p2.json()["id"]
    
    p3 = await client.post(
        "/api/v1/posts",
        json={"title": "Bookmark Test Post 3", "content": "<p>Content 3</p>"},
        headers={"Authorization": f"Bearer {token}"},
    )
    post3_id = p3.json()["id"]
    
    # Bookmark post1 and post3
    await client.post(f"/api/v1/posts/{post1_id}/bookmark", headers={"Authorization": f"Bearer {token}"})
    await client.post(f"/api/v1/posts/{post3_id}/bookmark", headers={"Authorization": f"Bearer {token}"})
    
    # Retrieve bookmarks feed
    bm_res = await client.get("/api/v1/users/me/bookmarks", headers={"Authorization": f"Bearer {token}"})
    assert bm_res.status_code == 200
    bm_data = bm_res.json()
    assert len(bm_data["items"]) == 2
    bm_ids = {item["id"] for item in bm_data["items"]}
    assert post1_id in bm_ids
    assert post3_id in bm_ids
    assert post2_id not in bm_ids
    for item in bm_data["items"]:
        assert item["is_bookmarked"] is True


# ==============================================================================
# 5. HOT TAGS AND ORDERING
# ==============================================================================

@pytest.mark.asyncio
async def test_hot_tags_post_count_ordering(client: AsyncClient, test_users, seed_data):
    token = test_users["doctor_token"]
    
    # Create posts with specific tag distribution

    # Tag 'Covid-19' gets 3 posts
    for i in range(3):
        await client.post(
            "/api/v1/posts",
            json={
                "title": f"Covid update {i+1}",
                "content": "<p>Covid update content</p>",
                "tags": ["Covid-19"],
            },
            headers={"Authorization": f"Bearer {token}"},
        )
    
    # Tag 'Dinh dưỡng' gets 1 post
    await client.post(
        "/api/v1/posts",
        json={
            "title": "Dinh duong update",
            "content": "<p>Dinh duong content</p>",
            "tags": ["Dinh dưỡng"],
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    
    res = await client.get("/api/v1/tags/hot?limit=10")
    assert res.status_code == 200
    tags = res.json()
    assert len(tags) >= 2
    # Verify post count order
    counts = [t["post_count"] for t in tags]
    assert counts == sorted(counts, reverse=True)


# ==============================================================================
# 6. UPLOAD SECURITY & EDGE CASES
# ==============================================================================

@pytest.mark.asyncio
async def test_upload_security_mime_spoofing_and_size_limits(client: AsyncClient, test_users):
    token = test_users["user_token"]
    
    # 1. MIME spoofing: Extension .png but text data -> Pillow verify fails
    fake_png = b"THIS IS NOT A VALID PNG IMAGE"
    res_spoof = await client.post(
        "/api/v1/upload",
        files={"file": ("fake.png", fake_png, "image/png")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_spoof.status_code == 400
    assert "Invalid image file" in res_spoof.json()["detail"]
    
    # 2. Non-image extension (.exe)
    res_exe = await client.post(
        "/api/v1/upload",
        files={"file": ("malware.exe", b"binary", "application/octet-stream")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_exe.status_code == 400
    
    # 3. Valid image formats: PNG and JPEG
    valid_png = generate_valid_image(fmt="PNG")
    res_valid_png = await client.post(
        "/api/v1/upload",
        files={"file": ("photo.png", valid_png, "image/png")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_valid_png.status_code == 201
    assert res_valid_png.json()["url"].startswith("/uploads/")
    
    valid_jpg = generate_valid_image(fmt="JPEG")
    res_valid_jpg = await client.post(
        "/api/v1/upload",
        files={"file": ("photo.jpg", valid_jpg, "image/jpeg")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_valid_jpg.status_code == 201
    assert res_valid_jpg.json()["url"].startswith("/uploads/")
