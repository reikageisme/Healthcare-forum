import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db } from '../src/db/index.js';
import { comments, posts } from '../src/db/schema.js';
import { closeDatabase, freshDatabase, request, seedUser } from './setup.js';

describe('bảng xếp hạng thành viên', () => {
  beforeAll(async () => freshDatabase());
  afterAll(async () => closeDatabase());

  it('xếp theo đóng góp công khai và không tính nội dung ẩn danh', async () => {
    const helpfulAuthor = await seedUser('user', { username: 'helpful-author' });
    const commenter = await seedUser('user', { username: 'active-commenter' });

    const [helpfulPost] = await db
      .insert(posts)
      .values({
        title: 'Bài hữu ích',
        slug: `bai-huu-ich-${Date.now()}`,
        content: '<p>Nội dung</p>',
        author_id: helpfulAuthor.id,
        helpful_count: 10,
      })
      .returning();
    const [commentPost] = await db
      .insert(posts)
      .values({
        title: 'Bài để thảo luận',
        slug: `bai-thao-luan-${Date.now()}`,
        content: '<p>Nội dung</p>',
        author_id: commenter.id,
      })
      .returning();

    await db.insert(comments).values(
      Array.from({ length: 5 }, (_, index) => ({
        post_id: commentPost!.id,
        author_id: commenter.id,
        content: `Bình luận ${index}`,
      })),
    );
    await db.insert(comments).values({
      post_id: helpfulPost!.id,
      author_id: commenter.id,
      content: 'Nội dung ẩn danh không tính điểm',
      is_anonymous: true,
    });

    const response = await request('/users/ranking?limit=5');
    expect(response.status).toBe(200);
    const ranking = (await response.json()) as Array<{
      id: string;
      rank: number;
      points: number;
      comment_count: number;
    }>;

    const first = ranking.find((member) => member.id === helpfulAuthor.id);
    const second = ranking.find((member) => member.id === commenter.id);
    expect(first?.points).toBe(35);
    expect(second?.points).toBe(15);
    expect(second?.comment_count).toBe(5);
    expect(first!.rank).toBeLessThan(second!.rank);
  });
});
