import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDatabase, freshDatabase, json, request, seedUser, type SeededUser } from './setup.js';

/**
 * Chuông thông báo.
 *
 * Trước đây nó chỉ là một cái icon không gắn với gì cả. Thứ dễ hỏng nhất khi
 * làm tính năng này không phải là "có gửi được không", mà là gửi quá tay:
 * tự báo cho chính mình, hoặc hai dòng cho cùng một câu trả lời.
 */

let ip = 0;
const nextIp = () => ({ 'x-forwarded-for': `10.120.${Math.floor(ip / 250)}.${ip++ % 250}` });

let author: SeededUser;

beforeAll(async () => {
  await freshDatabase();
  author = await seedUser('doctor');
});
afterAll(async () => {
  await closeDatabase();
});

async function createPost(token: string, title: string) {
  const res = await request('/posts', {
    method: 'POST',
    token,
    headers: nextIp(),
    body: json({ title, content: '<p>Nội dung bài viết đủ dài để qua kiểm tra.</p>' }),
  });
  return (await res.json()) as { id: string };
}

async function comment(token: string, postId: string, content: string, parentId?: string) {
  const res = await request(`/posts/${postId}/comments`, {
    method: 'POST',
    token,
    headers: nextIp(),
    body: json({ content, ...(parentId ? { parent_id: parentId } : {}) }),
  });
  expect(res.status).toBe(201);
  return (await res.json()) as { id: string };
}

const inbox = async (user: SeededUser) => {
  const res = await request('/notifications', { token: user.token, headers: nextIp() });
  expect(res.status).toBe(200);
  return (await res.json()) as {
    items: Array<{ id: string; type: string; title: string; is_read: boolean }>;
    unread_count: number;
  };
};

describe('thông báo', () => {
  it('có người bình luận bài của mình thì được báo', async () => {
    const post = await createPost(author.token, 'Bài để người khác vào bình luận');
    const reader = await seedUser('user');
    await comment(reader.token, post.id, 'Bài hay quá bác sĩ ạ');

    const box = await inbox(author);
    expect(box.unread_count).toBeGreaterThan(0);
    expect(box.items[0]!.type).toBe('comment');
    expect(box.items[0]!.title).toContain('bình luận');
  });

  it('tự bình luận bài của mình thì chuông không kêu', async () => {
    const solo = await seedUser('doctor');
    const post = await createPost(solo.token, 'Bài tôi tự bổ sung thêm ý');
    await comment(solo.token, post.id, 'Bổ sung: nhớ uống đủ nước');

    expect((await inbox(solo)).items).toHaveLength(0);
  });

  it('trả lời một bình luận thì người viết bình luận đó được báo', async () => {
    const post = await createPost(author.token, 'Thớt có người hỏi thêm');
    const asker = await seedUser('user');
    const root = await comment(asker.token, post.id, 'Cho em hỏi liều dùng ạ');

    const helper = await seedUser('user');
    await comment(helper.token, post.id, 'Bạn xem hướng dẫn nhé', root.id);

    const box = await inbox(asker);
    expect(box.items.some((n) => n.type === 'reply')).toBe(true);
  });

  it('tác giả bài kiêm người viết bình luận cha chỉ nhận MỘT thông báo', async () => {
    const owner = await seedUser('doctor');
    const post = await createPost(owner.token, 'Bài tôi vừa viết vừa trả lời');
    const root = await comment(owner.token, post.id, 'Mình bổ sung thêm ý này');

    const guest = await seedUser('user');
    await comment(guest.token, post.id, 'Cảm ơn bác sĩ', root.id);

    // Một câu trả lời, một dòng thông báo — không phải hai.
    expect((await inbox(owner)).items).toHaveLength(1);
  });

  it('bài được duyệt hay bị từ chối đều báo cho người viết', async () => {
    const member = await seedUser('user');
    const admin = await seedUser('admin');
    const post = await createPost(member.token, 'Bài chờ duyệt của thành viên');

    await request(`/admin/posts/${post.id}/approve`, {
      method: 'POST',
      token: admin.token,
      headers: nextIp(),
    });

    const box = await inbox(member);
    expect(box.items.some((n) => n.type === 'post_approved')).toBe(true);
  });

  it('đánh dấu đã đọc, và không đọc hộ được thông báo của người khác', async () => {
    const owner = await seedUser('doctor');
    const post = await createPost(owner.token, 'Bài để kiểm tra đánh dấu đã đọc');
    const reader = await seedUser('user');
    await comment(reader.token, post.id, 'Một bình luận');

    const before = await inbox(owner);
    const target = before.items[0]!;
    expect(before.unread_count).toBe(1);

    const stranger = await seedUser('user');
    const stolen = await request(`/notifications/${target.id}/read`, {
      method: 'POST',
      token: stranger.token,
      headers: nextIp(),
    });
    expect(stolen.status).toBe(404);
    expect((await inbox(owner)).unread_count).toBe(1);

    const mine = await request(`/notifications/${target.id}/read`, {
      method: 'POST',
      token: owner.token,
      headers: nextIp(),
    });
    expect(mine.status).toBe(204);
    expect((await inbox(owner)).unread_count).toBe(0);
  });

  it('khách chưa đăng nhập không xem được hộp thư của ai cả', async () => {
    const res = await request('/notifications', { headers: nextIp() });
    expect(res.status).toBe(401);
  });
});
