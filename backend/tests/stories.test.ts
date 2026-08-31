import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { eq, like } from 'drizzle-orm';
import { closeDatabase, freshDatabase, json, request, seedUser } from './setup.js';
import { db } from '../src/db/index.js';
import { stories } from '../src/db/schema.js';

beforeAll(async () => {
  await freshDatabase();
});
afterAll(async () => {
  await closeDatabase();
});

let ip = 0;
const nextIp = () => ({ 'x-forwarded-for': `10.5.${Math.floor(ip / 250)}.${ip++ % 250}` });

async function postStory(token: string, body: Record<string, unknown> = {}) {
  const res = await request('/stories', {
    method: 'POST',
    token,
    headers: nextIp(),
    body: json({ image_url: '/uploads/story.jpg', ...body }),
  });
  return { status: res.status, body: await res.json() };
}

describe('đăng story', () => {
  it('đăng được và hạn đúng 24 giờ', async () => {
    const author = await seedUser('doctor');
    const created = await postStory(author.token, { caption: 'Mẹo uống đủ nước mỗi ngày' });

    expect(created.status).toBe(201);
    expect(created.body.caption).toBe('Mẹo uống đủ nước mỗi ngày');
    expect(created.body.author.id).toBe(author.id);

    const life =
      new Date(created.body.expires_at).getTime() - new Date(created.body.created_at).getTime();
    expect(life).toBe(24 * 60 * 60 * 1000);
  });

  it('chỉ nhận ảnh tải lên qua diễn đàn', async () => {
    const author = await seedUser('doctor');
    const res = await postStory(author.token, { image_url: 'https://evil.example/x.jpg' });
    expect(res.status).toBe(400);
  });

  it('người chưa đăng nhập không đăng được', async () => {
    const res = await request('/stories', {
      method: 'POST',
      headers: nextIp(),
      body: json({ image_url: '/uploads/x.jpg' }),
    });
    expect(res.status).toBe(401);
  });
});

describe('story không đi qua hàng chờ nên bị chặn ngay', () => {
  it('từ chối thẳng chú thích quảng cáo, không đưa vào queue', async () => {
    const doctor = await seedUser('doctor');
    const res = await postStory(doctor.token, {
      caption: 'Thuốc gia truyền cam kết khỏi 100%, inbox đặt hàng ngay, giá chỉ 300k',
    });

    expect(res.status).toBe(400);
    // The message must say why, since there is no queue to appeal to.
    expect(res.body.detail).toContain('quảng cáo');
    expect(res.body.detail).toContain('24 giờ');

    // Scoped to this caption: other tests in the file share the database.
    const rows = await db
      .select()
      .from(stories)
      .where(like(stories.caption, '%cam kết khỏi 100%'));
    expect(rows).toHaveLength(0);
  });

  it('chú thích bình thường vẫn qua', async () => {
    const doctor = await seedUser('doctor');
    const res = await postStory(doctor.token, { caption: 'Nhắc mọi người tiêm nhắc cúm mùa' });
    expect(res.status).toBe(201);
  });
});

describe('xem story', () => {
  it('gom theo tác giả, cũ trước mới sau trong cùng một người', async () => {
    const author = await seedUser('doctor');
    await postStory(author.token, { caption: 'Story thứ nhất' });
    await postStory(author.token, { caption: 'Story thứ hai' });

    const feed = await (await request('/stories', { headers: nextIp() })).json();
    const group = feed.items.find((g: { author: { id: string } }) => g.author.id === author.id);

    expect(group.items).toHaveLength(2);
    expect(group.items[0].caption).toBe('Story thứ nhất');
    expect(group.items[1].caption).toBe('Story thứ hai');
  });

  it('story hết hạn không còn được trả về', async () => {
    const author = await seedUser('doctor');
    const created = await postStory(author.token, { caption: 'Sắp hết hạn' });

    // Move it into the past the way 24 hours would.
    await db
      .update(stories)
      .set({ expires_at: new Date(Date.now() - 60_000) })
      .where(eq(stories.id, created.body.id));

    const feed = await (await request('/stories', { headers: nextIp() })).json();
    const stillThere = feed.items
      .flatMap((g: { items: { id: string }[] }) => g.items)
      .some((s: { id: string }) => s.id === created.body.id);
    expect(stillThere).toBe(false);
  });

  it('vòng của chính mình xếp đầu tiên', async () => {
    const other = await seedUser('doctor');
    const me = await seedUser('doctor');
    await postStory(other.token, { caption: 'Của người khác' });
    await postStory(me.token, { caption: 'Của tôi' });

    const feed = await (
      await request('/stories', { token: me.token, headers: nextIp() })
    ).json();
    expect(feed.items[0].author.id).toBe(me.id);
  });

  it('không hiện story của tài khoản đã bị khóa', async () => {
    const { users } = await import('../src/db/schema.js');
    const banned = await seedUser('doctor');
    const created = await postStory(banned.token, { caption: 'Của tài khoản sắp bị khóa' });

    await db.update(users).set({ is_active: false }).where(eq(users.id, banned.id));

    const feed = await (await request('/stories', { headers: nextIp() })).json();
    const visible = feed.items
      .flatMap((g: { items: { id: string }[] }) => g.items)
      .some((s: { id: string }) => s.id === created.body.id);
    expect(visible).toBe(false);
  });
});

describe('xóa story', () => {
  it('tác giả xóa được, người ngoài thì không', async () => {
    const author = await seedUser('doctor');
    const stranger = await seedUser('user');
    const created = await postStory(author.token, { caption: 'Sẽ bị xóa' });

    const byStranger = await request(`/stories/${created.body.id}`, {
      method: 'DELETE',
      token: stranger.token,
      headers: nextIp(),
    });
    expect(byStranger.status).toBe(403);

    const byAuthor = await request(`/stories/${created.body.id}`, {
      method: 'DELETE',
      token: author.token,
      headers: nextIp(),
    });
    expect(byAuthor.status).toBe(204);
  });

  it('kiểm duyệt viên xóa được story của người khác', async () => {
    const author = await seedUser('doctor');
    const moderator = await seedUser('moderator');
    const created = await postStory(author.token, { caption: 'Bị kiểm duyệt xóa' });

    const res = await request(`/stories/${created.body.id}`, {
      method: 'DELETE',
      token: moderator.token,
      headers: nextIp(),
    });
    expect(res.status).toBe(204);
  });
});

describe('báo cáo story', () => {
  it('báo cáo được, và admin gỡ nội dung thì story biến mất', async () => {
    const author = await seedUser('doctor');
    const reporter = await seedUser('user');
    const admin = await seedUser('admin');
    const created = await postStory(author.token, { caption: 'Nội dung bị báo cáo' });

    const reported = await request('/reports', {
      method: 'POST',
      token: reporter.token,
      headers: nextIp(),
      body: json({
        target_type: 'story',
        target_id: created.body.id,
        reason: 'Nội dung sai lệch',
      }),
    });
    expect(reported.status).toBe(201);
    const report = await reported.json();
    expect(report.target_type).toBe('story');
    expect(report.target_title).toBe('Nội dung bị báo cáo');

    // The queue shows what it points at.
    const queue = await (
      await request('/admin/reports?status=open', { token: admin.token, headers: nextIp() })
    ).json();
    const row = queue.items.find((r: { id: string }) => r.id === report.id);
    expect(row.target_title).toBe('Nội dung bị báo cáo');

    const removed = await request(`/admin/reports/${report.id}/content`, {
      method: 'DELETE',
      token: admin.token,
      headers: nextIp(),
    });
    expect(removed.status).toBe(200);

    const rows = await db.select().from(stories).where(eq(stories.id, created.body.id));
    expect(rows).toHaveLength(0);
  });
});
