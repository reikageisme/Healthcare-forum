import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db } from '../src/db/index.js';
import { categories, comments, posts } from '../src/db/schema.js';
import { closeDatabase, freshDatabase, request, seedUser, type SeededUser } from './setup.js';

/**
 * Thẻ "Đang bàn luận" ở sidebar cổng tin tức.
 *
 * Đây là đường nối chiều ngược giữa hai tên miền, nên nó phải trả đúng thứ
 * người đọc mong đợi: thớt đang có người trả lời, mới nhất lên đầu. Một bài
 * vừa đăng chưa ai đọc mà lọt vào đây là cả thẻ mất nghĩa.
 */

let author: SeededUser;
let quietId: string;
let warmId: string;
let hotId: string;

const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000);

beforeAll(async () => {
  await freshDatabase();
  author = await seedUser('user');

  const [category] = await db
    .insert(categories)
    .values({ name: 'Tim mạch', slug: 'tim-mach' })
    .returning();

  const rows = await db
    .insert(posts)
    .values([
      {
        title: 'Bài chưa ai trả lời',
        slug: 'bai-chua-ai-tra-loi',
        content: '<p>Nội dung.</p>',
        author_id: author.id,
        category_id: category!.id,
        status: 'approved',
        is_published: true,
        comment_count: 0,
        created_at: at(1),
      },
      {
        title: 'Thớt có trả lời cũ',
        slug: 'thot-co-tra-loi-cu',
        content: '<p>Nội dung.</p>',
        author_id: author.id,
        category_id: category!.id,
        status: 'approved',
        is_published: true,
        comment_count: 1,
        created_at: at(600),
      },
      {
        title: 'Thớt vừa có người trả lời',
        slug: 'thot-vua-co-nguoi-tra-loi',
        content: '<p>Nội dung.</p>',
        author_id: author.id,
        category_id: category!.id,
        status: 'approved',
        is_published: true,
        comment_count: 2,
        created_at: at(900),
      },
      {
        title: 'Thớt chờ duyệt',
        slug: 'thot-cho-duyet',
        content: '<p>Nội dung.</p>',
        author_id: author.id,
        category_id: category!.id,
        status: 'pending',
        is_published: false,
        comment_count: 5,
        created_at: at(2),
      },
    ])
    .returning();

  quietId = rows[0]!.id;
  warmId = rows[1]!.id;
  hotId = rows[2]!.id;

  await db.insert(comments).values([
    { post_id: warmId, author_id: author.id, content: 'Trả lời cũ.', created_at: at(300) },
    { post_id: hotId, author_id: author.id, content: 'Trả lời cũ hơn.', created_at: at(400) },
    // Trả lời mới nhất trong cả bộ dữ liệu — thớt này phải lên đầu dù bài
    // được đăng sớm nhất.
    { post_id: hotId, author_id: author.id, content: 'Trả lời mới nhất.', created_at: at(5) },
  ]);
});

afterAll(async () => {
  await closeDatabase();
});

describe('GET /forum/hot-threads', () => {
  it('xếp theo lần trả lời gần nhất, không phải theo ngày đăng', async () => {
    const res = await request('/forum/hot-threads');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.map((t: { id: string }) => t.id)).toEqual([hotId, warmId]);
  });

  it('bỏ qua bài chưa có ai trả lời — không phải thứ "đang bàn luận"', async () => {
    const body = await (await request('/forum/hot-threads')).json();
    expect(body.map((t: { id: string }) => t.id)).not.toContain(quietId);
  });

  it('không để lọt bài chờ duyệt ra trang công khai', async () => {
    const body = await (await request('/forum/hot-threads')).json();
    expect(body.map((t: { title: string }) => t.title)).not.toContain('Thớt chờ duyệt');
  });

  it('trả đủ những gì thẻ sidebar cần vẽ', async () => {
    const body = await (await request('/forum/hot-threads')).json();
    expect(body[0]).toMatchObject({
      id: hotId,
      title: 'Thớt vừa có người trả lời',
      reply_count: 2,
      category_name: 'Tim mạch',
      category_slug: 'tim-mach',
    });
    expect(typeof body[0].last_activity_at).toBe('string');
  });

  it('giới hạn số dòng, và kẹp limit lạ về khoảng cho phép', async () => {
    expect((await (await request('/forum/hot-threads?limit=1')).json())).toHaveLength(1);
    // limit vô nghĩa không được làm sập endpoint hay xổ cả bảng ra.
    expect((await (await request('/forum/hot-threads?limit=abc')).json()).length).toBeLessThanOrEqual(10);
    expect((await (await request('/forum/hot-threads?limit=9999')).json()).length).toBeLessThanOrEqual(10);
  });

  it('cho phép cache một phút — trang tin không phụ thuộc diễn đàn còn sống', async () => {
    const res = await request('/forum/hot-threads');
    expect(res.headers.get('cache-control')).toContain('max-age=60');
  });
});
