import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, like } from 'drizzle-orm';
import { closeDatabase, freshDatabase, json, request, seedUser } from './setup.js';
import { db } from '../src/db/index.js';
import { categories } from '../src/db/schema.js';

/**
 * Trang tin là trang tin, diễn đàn là diễn đàn.
 *
 * Trước đây một bảng posts và một cây chuyên mục phục vụ cả hai tên miền, nên
 * medicvn.com và forums.medicvn.com hiện y hệt nhau — tách tên miền xong mà
 * người dùng vẫn thấy một sản phẩm. Những gì kiểm ở đây chính là ranh giới đó.
 */

let ip = 0;
const nextIp = () => ({ 'x-forwarded-for': `10.90.${Math.floor(ip / 250)}.${ip++ % 250}` });

beforeAll(async () => {
  await freshDatabase();
});
afterAll(async () => {
  await closeDatabase();
});

async function createPost(
  token: string,
  title: string,
  extra: Record<string, unknown> = {},
) {
  const res = await request('/posts', {
    method: 'POST',
    token,
    headers: nextIp(),
    body: json({ title, content: '<p>Nội dung bài viết đủ dài để qua kiểm tra.</p>', ...extra }),
  });
  return { status: res.status, body: await res.json() };
}

const idsAt = async (surface?: string) => {
  const query = surface ? `/posts?limit=50&surface=${surface}` : '/posts?limit=50';
  const body = await (await request(query, { headers: nextIp() })).json();
  return (body.items as Array<{ id: string }>).map((item) => item.id);
};

describe('bài viết thuộc đúng một trang', () => {
  it('bài của diễn đàn không lọt vào bảng tin của trang tin, và ngược lại', async () => {
    const admin = await seedUser('admin');

    const thread = await createPost(admin.token, 'Thớt bàn về giấc ngủ', { surface: 'forum' });
    const article = await createPost(admin.token, 'Bộ Y tế công bố hướng dẫn mới', {
      surface: 'portal',
    });
    expect(thread.status).toBe(201);
    expect(article.status).toBe(201);
    expect(article.body.surface).toBe('portal');

    const forumIds = await idsAt('forum');
    const portalIds = await idsAt('portal');

    expect(forumIds).toContain(thread.body.id);
    expect(forumIds).not.toContain(article.body.id);
    expect(portalIds).toContain(article.body.id);
    expect(portalIds).not.toContain(thread.body.id);

    // Không truyền surface thì không lọc — trang quản trị cần nhìn cả hai bên.
    const everything = await idsAt();
    expect(everything).toEqual(expect.arrayContaining([thread.body.id, article.body.id]));
  });

  it('không nói gì thì bài thuộc diễn đàn, nơi ai cũng viết được', async () => {
    const member = await seedUser('user');
    const posted = await createPost(member.token, 'Câu hỏi về đau lưng');
    expect(posted.body.surface).toBe('forum');
  });

  it('thành viên thường không đăng được lên trang tin', async () => {
    const member = await seedUser('user');
    const denied = await createPost(member.token, 'Tự nhận là tin tức', { surface: 'portal' });
    expect(denied.status).toBe(403);
  });

  it('bác sĩ và ban quản trị thì đăng được', async () => {
    const doctor = await seedUser('doctor');
    const posted = await createPost(doctor.token, 'Khuyến cáo tiêm chủng mùa dịch', {
      surface: 'portal',
    });
    expect(posted.status).toBe(201);
    expect(posted.body.surface).toBe('portal');
  });

  it('chỉ ban quản trị mới chuyển được bài sang trang bên kia', async () => {
    const doctor = await seedUser('doctor');
    const admin = await seedUser('admin');
    const posted = await createPost(doctor.token, 'Bài đăng nhầm chỗ');

    const byAuthor = await request(`/posts/${posted.body.id}`, {
      method: 'PUT',
      token: doctor.token,
      headers: nextIp(),
      body: json({ surface: 'portal' }),
    });
    expect(byAuthor.status).toBe(403);

    const byAdmin = await request(`/posts/${posted.body.id}`, {
      method: 'PUT',
      token: admin.token,
      headers: nextIp(),
      body: json({ surface: 'portal' }),
    });
    expect(byAdmin.status).toBe(200);
    expect((await byAdmin.json()).surface).toBe('portal');
  });
});

describe('hai cây chuyên mục', () => {
  it('trang tin được gieo sẵn cây chuyên trang của riêng nó', async () => {
    const body = await (await request('/categories?surface=portal', { headers: nextIp() })).json();
    const names = (body as Array<{ name: string; surface: string }>).map((c) => c.name);

    expect(names).toContain('Tin y tế');
    expect(body.every((c: { surface: string }) => c.surface === 'portal')).toBe(true);
  });

  it('cây chuyên khoa ở lại diễn đàn, không lẫn sang trang tin', async () => {
    const admin = await seedUser('admin');
    const created = await request('/categories', {
      method: 'POST',
      token: admin.token,
      headers: nextIp(),
      body: json({ name: 'Tim mạch can thiệp', surface: 'forum' }),
    });
    expect(created.status).toBe(201);

    const portal = await (
      await request('/categories?surface=portal', { headers: nextIp() })
    ).json();
    expect((portal as Array<{ name: string }>).map((c) => c.name)).not.toContain(
      'Tim mạch can thiệp',
    );
  });

  it('trang chủ diễn đàn chỉ liệt kê box của diễn đàn', async () => {
    const body = await (await request('/forum', { headers: nextIp() })).json();
    expect(body.every((c: { surface: string }) => c.surface === 'forum')).toBe(true);
  });
});

describe('tên chuyên mục dính dấu gạch', () => {
  it('được chuẩn hoá thành "A - B", không phải "A-b"', async () => {
    // Cây gieo sẵn nào có dấu gạch cũng phải có khoảng trắng hai bên. Một cái
    // tên như "Chính sách-bảo hiểm y tế" đọc ra là một lỗi gõ.
    const rows = await db.select().from(categories).where(like(categories.name, '%-%'));
    for (const row of rows) {
      expect(row.name).not.toMatch(/\S-|-\S/);
    }
  });

  it('slug không đổi theo, nên link đã chia sẻ không gãy', async () => {
    const rows = await db
      .select()
      .from(categories)
      .where(eq(categories.slug, 'chinh-sach-bao-hiem-y-te'))
      .limit(1);
    expect(rows[0]?.name).toBe('Chính sách - Bảo hiểm y tế');
  });
});
