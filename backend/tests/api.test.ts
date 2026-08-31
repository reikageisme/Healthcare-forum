import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { closeDatabase, freshDatabase, json, request, seedUser } from './setup.js';
import { db } from '../src/db/index.js';
import { categories } from '../src/db/schema.js';

beforeAll(async () => {
  await freshDatabase();
});
afterAll(async () => {
  await closeDatabase();
});

let ip = 0;
const nextIp = () => ({ 'x-forwarded-for': `10.9.${Math.floor(ip / 250)}.${ip++ % 250}` });

async function createPost(token: string, title: string, extra: Record<string, unknown> = {}) {
  const res = await request('/posts', {
    method: 'POST',
    token,
    headers: nextIp(),
    body: json({ title, content: '<p>Nội dung bài viết đủ dài để qua kiểm tra.</p>', ...extra }),
  });
  expect(res.status).toBe(201);
  return res.json();
}

describe('auth', () => {
  it('registers, logs in, and reads the profile back', async () => {
    const email = 'newcomer@test.vn';
    const registered = await request('/auth/register', {
      method: 'POST',
      headers: nextIp(),
      body: json({ email, username: 'newcomer', password: 'CorrectHorse123!' }),
    });
    expect(registered.status).toBe(201);
    const tokens = await registered.json();
    expect(tokens.token_type).toBe('bearer');

    const me = await request('/auth/me', { token: tokens.access_token, headers: nextIp() });
    expect(me.status).toBe(200);
    const profile = await me.json();
    expect(profile.email).toBe(email);
    expect(profile.role).toBe('user');
    // snake_case is the contract the frontend types are written against.
    expect(profile).toHaveProperty('is_active');
    expect(profile).toHaveProperty('created_at');
    expect(profile).not.toHaveProperty('isActive');

    const login = await request('/auth/login', {
      method: 'POST',
      headers: nextIp(),
      body: json({ email, password: 'CorrectHorse123!' }),
    });
    expect(login.status).toBe(200);
  });

  it('refuses a duplicate email', async () => {
    const existing = await seedUser('user', { email: 'taken@test.vn' });
    const res = await request('/auth/register', {
      method: 'POST',
      headers: nextIp(),
      body: json({ email: existing.email, username: 'other', password: 'CorrectHorse123!' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('hybrid moderation on create', () => {
  it('auto-approves trusted roles and queues everyone else', async () => {
    const doctor = await seedUser('doctor');
    const member = await seedUser('user');

    const byDoctor = await createPost(doctor.token, 'Bài của bác sĩ');
    const byMember = await createPost(member.token, 'Bài của thành viên');

    expect(byDoctor.status).toBe('approved');
    expect(byMember.status).toBe('pending');
  });
});

describe('post feed', () => {
  it('paginates by cursor without repeating or skipping', async () => {
    const doctor = await seedUser('doctor');
    for (let i = 0; i < 7; i += 1) {
      await createPost(doctor.token, `Bài phân trang số ${i}`);
    }

    const first = await request('/posts?limit=3', { headers: nextIp() });
    const page1 = await first.json();
    expect(page1.items).toHaveLength(3);
    expect(page1.has_more).toBe(true);
    expect(page1.next_cursor).toBeTruthy();
    expect(page1.limit).toBe(3);

    const second = await request(`/posts?limit=3&cursor=${encodeURIComponent(page1.next_cursor)}`, {
      headers: nextIp(),
    });
    const page2 = await second.json();
    expect(page2.items).toHaveLength(3);

    const ids1 = page1.items.map((p: { id: string }) => p.id);
    const ids2 = page2.items.map((p: { id: string }) => p.id);
    expect(ids1.some((id: string) => ids2.includes(id))).toBe(false);
  });

  it('keeps pending posts out of the public feed', async () => {
    const member = await seedUser('user');
    const hidden = await createPost(member.token, 'Bài không được hiện');

    const res = await request('/posts?limit=50', { headers: nextIp() });
    const body = await res.json();
    expect(body.items.some((p: { id: string }) => p.id === hidden.id)).toBe(false);
  });

  it('filters by search term', async () => {
    const doctor = await seedUser('doctor');
    await createPost(doctor.token, 'Bệnh tiểu đường tuýp hai');

    const res = await request('/posts?search=tiểu đường&limit=50', { headers: nextIp() });
    const body = await res.json();
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items[0].title).toContain('tiểu đường');
  });
});

describe('categories and tags', () => {
  it('creates a category with a Vietnamese slug and counts approved posts', async () => {
    const admin = await seedUser('admin');
    const created = await request('/categories', {
      method: 'POST',
      token: admin.token,
      headers: nextIp(),
      body: json({ name: 'Tiểu đường và nội tiết' }),
    });
    expect(created.status).toBe(201);
    const category = await created.json();
    // python-slugify's transliteration is what the existing slugs were built
    // with; đ has to become d rather than disappear.
    expect(category.slug).toBe('tieu-duong-va-noi-tiet');
    expect(category.post_count).toBe(0);

    const doctor = await seedUser('doctor');
    await createPost(doctor.token, 'Bài trong chuyên mục', { category_id: category.id });

    const listed = await request('/categories', { headers: nextIp() });
    const all = await listed.json();
    const found = all.find((x: { id: string }) => x.id === category.id);
    expect(found.post_count).toBe(1);
  });

  it('creates tags on demand and lists them by heat', async () => {
    const doctor = await seedUser('doctor');
    await createPost(doctor.token, 'Bài có thẻ', { tags: ['Sốt xuất huyết', 'Tiêm chủng'] });

    const res = await request('/tags/hot', { headers: nextIp() });
    const hot = await res.json();
    const names = hot.map((t: { name: string }) => t.name);
    expect(names).toContain('Sốt xuất huyết');

    const search = await request('/tags/search?q=tiem', { headers: nextIp() });
    expect(search.status).toBe(200);
  });
});

describe('post editing', () => {
  it('keeps existing tags when an edit omits them, and clears them on an explicit empty list', async () => {
    const doctor = await seedUser('doctor');
    const post = await createPost(doctor.token, 'Bài có thẻ cần giữ', {
      tags: ['Mất ngủ', 'Kháng sinh'],
    });
    expect(post.tags).toHaveLength(2);

    // An edit that does not mention tags must not strip them.
    const titleOnly = await request(`/posts/${post.id}`, {
      method: 'PUT',
      token: doctor.token,
      headers: nextIp(),
      body: json({ title: 'Tiêu đề đã đổi' }),
    });
    expect(titleOnly.status).toBe(200);
    expect((await titleOnly.json()).tags).toHaveLength(2);

    // tags: [] with no tag_names also means "leave them alone", matching
    // `post_in.tags or post_in.tag_names`.
    const emptyTags = await request(`/posts/${post.id}`, {
      method: 'PUT',
      token: doctor.token,
      headers: nextIp(),
      body: json({ tags: [] }),
    });
    expect((await emptyTags.json()).tags).toHaveLength(2);

    // An explicit tag_names list replaces them.
    const replaced = await request(`/posts/${post.id}`, {
      method: 'PUT',
      token: doctor.token,
      headers: nextIp(),
      body: json({ tag_names: ['Covid-19'] }),
    });
    const body = await replaced.json();
    expect(body.tags).toHaveLength(1);
    expect(body.tags[0].name).toBe('Covid-19');
  });

  it('refuses an edit from someone who is neither author nor staff', async () => {
    const doctor = await seedUser('doctor');
    const stranger = await seedUser('user');
    const post = await createPost(doctor.token, 'Bài của người khác');

    const res = await request(`/posts/${post.id}`, {
      method: 'PUT',
      token: stranger.token,
      headers: nextIp(),
      body: json({ title: 'Cướp bài viết' }),
    });
    expect(res.status).toBe(403);
  });
});

describe('category tree', () => {
  async function makeCategory(token: string, body: Record<string, unknown>) {
    const res = await request('/categories', {
      method: 'POST',
      token,
      headers: nextIp(),
      body: json(body),
    });
    return { status: res.status, body: await res.json() };
  }

  it('nests a child under a parent and rolls the child’s posts up', async () => {
    const admin = await seedUser('admin');
    const doctor = await seedUser('doctor');

    const parent = await makeCategory(admin.token, { name: 'Nội khoa tổng quát' });
    expect(parent.status).toBe(201);
    expect(parent.body.parent_id).toBeNull();

    const child = await makeCategory(admin.token, {
      name: 'Tim mạch can thiệp',
      parent_id: parent.body.id,
    });
    expect(child.status).toBe(201);
    expect(child.body.parent_id).toBe(parent.body.id);

    await createPost(doctor.token, 'Bài thuộc chuyên mục con', {
      category_id: child.body.id,
    });
    await createPost(doctor.token, 'Bài thuộc chuyên mục cha', {
      category_id: parent.body.id,
    });

    // Opening the parent shows both.
    const parentFeed = await (
      await request(`/posts?category=${parent.body.slug}&limit=50`, { headers: nextIp() })
    ).json();
    const titles = parentFeed.items.map((p: { title: string }) => p.title);
    expect(titles).toContain('Bài thuộc chuyên mục con');
    expect(titles).toContain('Bài thuộc chuyên mục cha');

    // Opening the child shows only its own.
    const childFeed = await (
      await request(`/posts?category=${child.body.slug}&limit=50`, { headers: nextIp() })
    ).json();
    const childTitles = childFeed.items.map((p: { title: string }) => p.title);
    expect(childTitles).toContain('Bài thuộc chuyên mục con');
    expect(childTitles).not.toContain('Bài thuộc chuyên mục cha');

    // post_count follows the same rule.
    const listed = await (await request('/categories', { headers: nextIp() })).json();
    const parentRow = listed.find((x: { id: string }) => x.id === parent.body.id);
    const childRow = listed.find((x: { id: string }) => x.id === child.body.id);
    expect(parentRow.post_count).toBe(2);
    expect(childRow.post_count).toBe(1);

    // Children are listed straight after their parent.
    const ids = listed.map((x: { id: string }) => x.id);
    expect(ids.indexOf(child.body.id)).toBe(ids.indexOf(parent.body.id) + 1);
  });

  it('caps the tree at two levels', async () => {
    const admin = await seedUser('admin');
    const parent = await makeCategory(admin.token, { name: 'Cấp một' });
    const child = await makeCategory(admin.token, {
      name: 'Cấp hai',
      parent_id: parent.body.id,
    });

    const grandchild = await makeCategory(admin.token, {
      name: 'Cấp ba',
      parent_id: child.body.id,
    });
    expect(grandchild.status).toBe(400);
    expect(grandchild.body.detail).toContain('hai cấp');
  });

  it('refuses to make a category its own parent', async () => {
    const admin = await seedUser('admin');
    const cat = await makeCategory(admin.token, { name: 'Tự tham chiếu' });

    const res = await request(`/categories/${cat.body.id}`, {
      method: 'PUT',
      token: admin.token,
      headers: nextIp(),
      body: json({ parent_id: cat.body.id }),
    });
    expect(res.status).toBe(400);
  });

  it('refuses to demote a category that already has children', async () => {
    const admin = await seedUser('admin');
    const a = await makeCategory(admin.token, { name: 'Nhánh A' });
    const b = await makeCategory(admin.token, { name: 'Nhánh B' });
    await makeCategory(admin.token, { name: 'Con của A', parent_id: a.body.id });

    const res = await request(`/categories/${a.body.id}`, {
      method: 'PUT',
      token: admin.token,
      headers: nextIp(),
      body: json({ parent_id: b.body.id }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).detail).toContain('chuyên mục con');
  });

  it('detaches a child when parent_id is sent as null', async () => {
    const admin = await seedUser('admin');
    const parent = await makeCategory(admin.token, { name: 'Cha sẽ bị tách' });
    const child = await makeCategory(admin.token, {
      name: 'Con sẽ được tách',
      parent_id: parent.body.id,
    });

    const res = await request(`/categories/${child.body.id}`, {
      method: 'PUT',
      token: admin.token,
      headers: nextIp(),
      body: json({ parent_id: null }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).parent_id).toBeNull();
  });

  it('leaves children standing when the parent is deleted', async () => {
    const admin = await seedUser('admin');
    const parent = await makeCategory(admin.token, { name: 'Cha sẽ bị xoá' });
    const child = await makeCategory(admin.token, {
      name: 'Con phải sống sót',
      parent_id: parent.body.id,
    });

    const deleted = await request(`/categories/${parent.body.id}`, {
      method: 'DELETE',
      token: admin.token,
      headers: nextIp(),
    });
    expect(deleted.status).toBe(204);

    const after = await request(`/categories/${child.body.id}`, { headers: nextIp() });
    expect(after.status).toBe(200);
    expect((await after.json()).parent_id).toBeNull();
  });
});

describe('comments', () => {
  it('builds a nested tree and tombstones a parent that has replies', async () => {
    const doctor = await seedUser('doctor');
    const post = await createPost(doctor.token, 'Bài để bình luận');

    const parentRes = await request(`/posts/${post.id}/comments`, {
      method: 'POST',
      token: doctor.token,
      headers: nextIp(),
      body: json({ content: 'Bình luận gốc' }),
    });
    const parent = await parentRes.json();

    await request(`/posts/${post.id}/comments`, {
      method: 'POST',
      token: doctor.token,
      headers: nextIp(),
      body: json({ content: 'Trả lời', parent_id: parent.id }),
    });

    const tree = await (await request(`/posts/${post.id}/comments`, { headers: nextIp() })).json();
    expect(tree).toHaveLength(1);
    expect(tree[0].replies).toHaveLength(1);
    expect(tree[0].replies[0].content).toBe('Trả lời');

    const deleted = await request(`/comments/${parent.id}`, {
      method: 'DELETE',
      token: doctor.token,
      headers: nextIp(),
    });
    expect(deleted.status).toBe(204);

    const after = await (await request(`/posts/${post.id}/comments`, { headers: nextIp() })).json();
    expect(after[0].is_deleted).toBe(true);
    expect(after[0].content).toBe('[Bình luận đã bị xóa]');
    expect(after[0].replies).toHaveLength(1);
  });
});

describe('reactions', () => {
  it('adds, switches and removes, keeping helpful_count in step', async () => {
    const doctor = await seedUser('doctor');
    const reader = await seedUser('user');
    const post = await createPost(doctor.token, 'Bài để thả cảm xúc');

    const added = await (
      await request(`/posts/${post.id}/reactions`, {
        method: 'POST',
        token: reader.token,
        headers: nextIp(),
        body: json({ reaction_type: 'helpful' }),
      })
    ).json();
    expect(added.action).toBe('added');
    expect(added.counts.helpful).toBe(1);
    expect(added.counts.total).toBe(1);

    const switched = await (
      await request(`/posts/${post.id}/reactions`, {
        method: 'POST',
        token: reader.token,
        headers: nextIp(),
        body: json({ reaction_type: 'like' }),
      })
    ).json();
    expect(switched.action).toBe('updated');
    expect(switched.counts.helpful).toBe(0);
    expect(switched.counts.like).toBe(1);

    const removed = await (
      await request(`/posts/${post.id}/reactions`, {
        method: 'POST',
        token: reader.token,
        headers: nextIp(),
        body: json({ reaction_type: 'like' }),
      })
    ).json();
    expect(removed.action).toBe('removed');
    expect(removed.counts.total).toBe(0);

    const detail = await (await request(`/posts/${post.id}`, { headers: nextIp() })).json();
    expect(detail.helpful_count).toBe(0);
  });

  it('accepts uppercase reaction types the way the Pydantic validator did', async () => {
    const doctor = await seedUser('doctor');
    const reader = await seedUser('user');
    const post = await createPost(doctor.token, 'Bài kiểm tra enum hoa');

    const res = await request(`/posts/${post.id}/reactions`, {
      method: 'POST',
      token: reader.token,
      headers: nextIp(),
      body: json({ reaction_type: 'HELPFUL' }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).current_reaction).toBe('helpful');
  });
});

describe('bookmarks', () => {
  it('toggles and lists with the post’s real status', async () => {
    const doctor = await seedUser('doctor');
    const reader = await seedUser('user');
    const post = await createPost(doctor.token, 'Bài để lưu');

    const on = await (
      await request(`/posts/${post.id}/bookmark`, {
        method: 'POST',
        token: reader.token,
        headers: nextIp(),
      })
    ).json();
    expect(on.is_bookmarked).toBe(true);

    const list = await (
      await request('/users/me/bookmarks', { token: reader.token, headers: nextIp() })
    ).json();
    expect(list.items).toHaveLength(1);
    expect(list.items[0].is_bookmarked).toBe(true);
    // The Python endpoint omitted status, so Pydantic defaulted every saved
    // post to "pending" and FeedCard drew a review badge on all of them.
    expect(list.items[0].status).toBe('approved');

    const off = await (
      await request(`/posts/${post.id}/bookmark`, {
        method: 'POST',
        token: reader.token,
        headers: nextIp(),
      })
    ).json();
    expect(off.is_bookmarked).toBe(false);
  });
});

describe('reports', () => {
  it('creates one and refuses a duplicate from the same reporter', async () => {
    const doctor = await seedUser('doctor');
    const reporter = await seedUser('user');
    const post = await createPost(doctor.token, 'Bài bị báo cáo');

    const first = await request('/reports', {
      method: 'POST',
      token: reporter.token,
      headers: nextIp(),
      body: json({ target_type: 'post', target_id: post.id, reason: 'Nội dung sai lệch' }),
    });
    expect(first.status).toBe(201);
    const report = await first.json();
    expect(report.status).toBe('open');
    expect(report.target_title).toBe('Bài bị báo cáo');

    const second = await request('/reports', {
      method: 'POST',
      token: reporter.token,
      headers: nextIp(),
      body: json({ target_type: 'post', target_id: post.id, reason: 'Lần hai' }),
    });
    expect(second.status).toBe(400);
  });
});

describe('admin', () => {
  it('returns a zero-filled time series of exactly the requested length', async () => {
    const admin = await seedUser('admin');

    const res = await request('/admin/stats?days=30', { token: admin.token, headers: nextIp() });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.time_series).toHaveLength(30);
    expect(body.overview).toHaveProperty('total_users');
    expect(body.totals).toEqual(body.overview);

    // Continuous, ascending, one day apart, with zeros where nothing happened.
    for (let i = 1; i < body.time_series.length; i += 1) {
      const prev = new Date(`${body.time_series[i - 1].date}T00:00:00Z`).getTime();
      const cur = new Date(`${body.time_series[i].date}T00:00:00Z`).getTime();
      expect(cur - prev).toBe(86_400_000);
    }
    const last = body.time_series[body.time_series.length - 1];
    expect(typeof last.new_users).toBe('number');
    expect(body.time_series.some((d: { new_users: number }) => d.new_users === 0)).toBe(true);

    const seven = await (
      await request('/admin/stats?days=7', { token: admin.token, headers: nextIp() })
    ).json();
    expect(seven.time_series).toHaveLength(7);
  });

  it('serves the moderation queue on both the alias and the canonical path', async () => {
    const admin = await seedUser('admin');
    const member = await seedUser('user');
    await createPost(member.token, 'Bài chờ kiểm duyệt');

    const canonical = await request('/admin/posts?status=pending', {
      token: admin.token,
      headers: nextIp(),
    });
    const alias = await request('/admin/moderation/posts?status=pending', {
      token: admin.token,
      headers: nextIp(),
    });

    expect(canonical.status).toBe(200);
    expect(alias.status).toBe(200);

    const a = await canonical.json();
    const b = await alias.json();
    expect(a.items.map((p: { id: string }) => p.id)).toEqual(
      b.items.map((p: { id: string }) => p.id),
    );
    expect(a.total).toBe(b.total);
    expect(a).toHaveProperty('total_pages');
    expect(a).toHaveProperty('pages');
  });

  it('approves and rejects through the alias routes', async () => {
    const admin = await seedUser('admin');
    const member = await seedUser('user');
    const toApprove = await createPost(member.token, 'Bài sẽ được duyệt');
    const toReject = await createPost(member.token, 'Bài sẽ bị từ chối');

    const approved = await request(`/admin/moderation/posts/${toApprove.id}/approve`, {
      method: 'POST',
      token: admin.token,
      headers: nextIp(),
    });
    expect(approved.status).toBe(200);
    const approvedBody = await approved.json();
    expect(approvedBody.post.status).toBe('approved');
    expect(approvedBody.post.rejection_reason).toBeNull();

    const rejected = await request(`/admin/moderation/posts/${toReject.id}/reject`, {
      method: 'POST',
      token: admin.token,
      headers: nextIp(),
      body: json({ reason: 'Thiếu nguồn tham khảo' }),
    });
    expect(rejected.status).toBe(200);
    const rejectedBody = await rejected.json();
    expect(rejectedBody.post.status).toBe('rejected');
    expect(rejectedBody.rejection_reason).toBe('Thiếu nguồn tham khảo');
  });

  it('lists users with post and comment counts', async () => {
    const admin = await seedUser('admin');
    const doctor = await seedUser('doctor');
    const post = await createPost(doctor.token, 'Bài để đếm');
    await request(`/posts/${post.id}/comments`, {
      method: 'POST',
      token: doctor.token,
      headers: nextIp(),
      body: json({ content: 'Một bình luận' }),
    });

    const res = await request('/admin/users?limit=100', { token: admin.token, headers: nextIp() });
    const body = await res.json();
    const row = body.items.find((u: { id: string }) => u.id === doctor.id);
    expect(row.post_count).toBeGreaterThanOrEqual(1);
    expect(row.comment_count).toBeGreaterThanOrEqual(1);
  });

  it('stops an admin from demoting or deactivating themselves', async () => {
    const admin = await seedUser('admin');

    const demote = await request(`/admin/users/${admin.id}/role`, {
      method: 'PUT',
      token: admin.token,
      headers: nextIp(),
      body: json({ role: 'user' }),
    });
    expect(demote.status).toBe(400);

    const deactivate = await request(`/admin/users/${admin.id}/status`, {
      method: 'PUT',
      token: admin.token,
      headers: nextIp(),
      body: json({ is_active: false }),
    });
    expect(deactivate.status).toBe(400);

    const patched = await request(`/admin/users/${admin.id}`, {
      method: 'PATCH',
      token: admin.token,
      headers: nextIp(),
      body: json({ is_active: false }),
    });
    expect(patched.status).toBe(400);
  });

  it('keeps role changes out of a moderator’s hands', async () => {
    const moderator = await seedUser('moderator');
    const victim = await seedUser('user');

    const res = await request(`/admin/users/${victim.id}/role`, {
      method: 'PUT',
      token: moderator.token,
      headers: nextIp(),
      body: json({ role: 'admin' }),
    });
    expect(res.status).toBe(403);
  });

  it('removes reported content and resolves every open report on it', async () => {
    const admin = await seedUser('admin');
    const doctor = await seedUser('doctor');
    const reporterA = await seedUser('user');
    const reporterB = await seedUser('user');
    const post = await createPost(doctor.token, 'Bài vi phạm');

    for (const reporter of [reporterA, reporterB]) {
      const created = await request('/reports', {
        method: 'POST',
        token: reporter.token,
        headers: nextIp(),
        body: json({ target_type: 'post', target_id: post.id, reason: 'Spam' }),
      });
      expect(created.status).toBe(201);
    }

    const open = await (
      await request('/admin/reports?status=open', { token: admin.token, headers: nextIp() })
    ).json();
    const mine = open.items.filter((r: { target_id: string }) => r.target_id === post.id);
    expect(mine).toHaveLength(2);

    const removed = await request(`/admin/reports/${mine[0].id}/content`, {
      method: 'DELETE',
      token: admin.token,
      headers: nextIp(),
    });
    expect(removed.status).toBe(200);

    const after = await (
      await request('/admin/reports?status=open', { token: admin.token, headers: nextIp() })
    ).json();
    expect(after.items.filter((r: { target_id: string }) => r.target_id === post.id)).toHaveLength(0);

    const gone = await request(`/posts/${post.id}`, { headers: nextIp() });
    expect(gone.status).toBe(404);
  });
});

describe('health', () => {
  it('answers on the same path the Python app used', async () => {
    const res = await request('/health', { headers: nextIp() });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok', version: '1.0.0' });
  });
});
