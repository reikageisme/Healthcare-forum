import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db } from '../src/db/index.js';
import { categories, postTags, posts, tags } from '../src/db/schema.js';
import { closeDatabase, freshDatabase, request, seedUser } from './setup.js';

let authorId: string;
let mixedTagSlug: string;
let categoryId: string;
const tagIds: Record<string, string> = {};

async function addPost(
  name: string,
  status: 'pending' | 'approved' | 'rejected',
  isPublished: boolean,
  tagNames: string[],
) {
  const [post] = await db.insert(posts).values({
    title: 'Tag fixture ' + name,
    slug: 'tag-fixture-' + name,
    content: '<p>Tag fixture content.</p>',
    author_id: authorId,
    status,
    is_published: isPublished,
    category_id: categoryId,
  }).returning();
  await db.insert(postTags).values(tagNames.map((tagName) => ({
    post_id: post!.id,
    tag_id: tagIds[tagName]!,
  })));
  return post!;
}

beforeAll(async () => {
  await freshDatabase();
  authorId = (await seedUser('doctor')).id;
  const [category] = await db.insert(categories).values({
    name: 'G6 tag category', slug: 'g6-tag-category',
  }).returning();
  categoryId = category!.id;

  for (const name of ['mixed', 'alpha', 'beta', 'zero']) {
    const [tag] = await db.insert(tags).values({
      name, slug: 'g6-' + name,
    }).returning();
    tagIds[name] = tag!.id;
  }
  mixedTagSlug = 'g6-mixed';

  await addPost('public', 'approved', true, ['mixed', 'alpha']);
  await addPost('public-two', 'approved', true, ['alpha']);
  await addPost('pending', 'pending', true, ['mixed', 'beta']);
  await addPost('rejected', 'rejected', true, ['mixed', 'beta']);
  await addPost('unpublished', 'approved', false, ['mixed', 'beta']);
});

afterAll(closeDatabase);

describe('G6 public tag aggregation', () => {
  it('TAG-01 counts only approved and published posts for a tag detail', async () => {
    const response = await request('/tags/' + mixedTagSlug);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ slug: mixedTagSlug, post_count: 1 });
  });

  it('TAG-02 orders hot tags by filtered public post count and keeps zero tags', async () => {
    const response = await request('/tags/hot?limit=10');
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.filter((tag: { slug: string }) => tag.slug.startsWith('g6-'))).toEqual([
      expect.objectContaining({ slug: 'g6-alpha', post_count: 2 }),
      expect.objectContaining({ slug: 'g6-mixed', post_count: 1 }),
      expect.objectContaining({ slug: 'g6-beta', post_count: 0 }),
      expect.objectContaining({ slug: 'g6-zero', post_count: 0 }),
    ]);
  });

  it('TAG-03 keeps category counts aligned with the same public predicate', async () => {
    const response = await request('/categories/' + categoryId);
    expect(response.status).toBe(200);
    expect((await response.json()).post_count).toBe(2);
  });
});
