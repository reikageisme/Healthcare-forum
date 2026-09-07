import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/index.js';
import { comments, posts } from '../src/db/schema.js';
import { sanitizeRichText } from '../src/lib/sanitize.js';
import { closeDatabase, freshDatabase, json, request, seedUser } from './setup.js';

let author: Awaited<ReturnType<typeof seedUser>>;

function expectSafeHtml(html: string) {
  expect(html).not.toMatch(/<\/?script\b/i);
  expect(html).not.toMatch(/\son\w+\s*=/i);
  expect(html).not.toMatch(/javascript\s*:/i);
  expect(html).not.toMatch(/data\s*:/i);
  expect(html).not.toMatch(/style\s*=/i);
}

beforeAll(async () => {
  await freshDatabase();
  author = await seedUser('doctor');
});

afterAll(closeDatabase);

describe('G5 sanitizer policy', () => {
  it('XSS-01..05 keeps TipTap formatting and strips executable nodes, attributes, URLs and styles', () => {
    const clean = sanitizeRichText(`
      <h1>Heading</h1><p><strong>Bold</strong> <em>emphasis</em> <s>strike</s></p>
      <ul><li>One</li></ul><blockquote>Quote</blockquote><pre><code>const x = 1;</code></pre>
      <p onclick="alert(1)" style="background:url(javascript:alert(1))">Text</p>
      <a href="javascript:alert(1)" onmouseover="alert(1)">Bad link</a>
      <a href="https://example.com/ok">Good link</a>
      <img src="data:image/svg+xml,<svg onload=alert(1)>" onerror="alert(1)">
      <img src="/uploads/health.png" alt="Good image">
    `);

    expectSafeHtml(clean);
    expect(clean).toContain('<h1>Heading</h1>');
    expect(clean).toContain('<strong>Bold</strong>');
    expect(clean).toContain('href="https://example.com/ok"');
    expect(clean).toContain('src="/uploads/health.png"');
  });

  it('XSS-06 rejects content that becomes empty or too short after cleaning', async () => {
    const before = await db.select({ n: posts.id }).from(posts);
    for (const content of ['<script>alert(1)</script>', '<p>abcd</p>']) {
      const response = await request('/posts', {
        method: 'POST', token: author.token,
        body: json({ title: 'Rejected unsafe content', content }),
      });
      expect(response.status).toBe(422);
      expect(await response.json()).toEqual({
        detail: 'Post content must contain at least 5 visible characters',
      });
    }
    expect(await db.select({ n: posts.id }).from(posts)).toEqual(before);
  });

  it('XSS-07 sanitizes before excerpt/search persistence and rejects unsafe thumbnails', async () => {
    const content = '<script>alert(1)</script><p>Visible health content.</p>';
    const response = await request('/posts', {
      method: 'POST', token: author.token,
      body: json({ title: 'Safe stored post', content, thumbnail: '/uploads/thumb.png' }),
    });
    expect(response.status).toBe(201);
    const body = await response.json();
    expectSafeHtml(body.content);
    expect(body.content).toContain('Visible health content.');
    expect(body.excerpt).toBe('Visible health content.');
    expect(body.thumbnail).toBe('/uploads/thumb.png');

    const [stored] = await db.select().from(posts).where(eq(posts.id, body.id));
    expect(stored).toMatchObject({ excerpt: 'Visible health content.', thumbnail: '/uploads/thumb.png' });
    expectSafeHtml(stored!.content);
    expect(stored!.search_text).not.toContain('alert');

    const invalidThumbnail = await request('/posts', {
      method: 'POST', token: author.token,
      body: json({
        title: 'Invalid thumbnail post', content: '<p>Visible content.</p>',
        thumbnail: 'data:image/svg+xml,<svg onload=alert(1)>',
      }),
    });
    expect(invalidThumbnail.status).toBe(422);
    expect(await invalidThumbnail.json()).toEqual({ detail: 'Thumbnail URL is not safe' });
  });

  it('XSS-07 rejects an unsafe update before changing the old row', async () => {
    const created = await request('/posts', {
      method: 'POST', token: author.token,
      body: json({ title: 'Update preservation post', content: '<p>Original content.</p>' }),
    });
    const original = await created.json();
    const response = await request(`/posts/${original.id}`, {
      method: 'PUT', token: author.token,
      body: json({ content: '<script>alert(1)</script>' }),
    });
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      detail: 'Post content must contain at least 5 visible characters',
    });
    const [stored] = await db.select().from(posts).where(eq(posts.id, original.id));
    expect(stored!.content).toBe('<p>Original content.</p>');
  });

  it('XSS-08 sanitizes legacy post and comment rows at response time', async () => {
    const [legacyPost] = await db.insert(posts).values({
      title: 'Legacy unsafe row', slug: `legacy-${Date.now()}`,
      content: '<p>Legacy text</p><script>alert(1)</script><img src="javascript:alert(1)">',
      author_id: author.id, status: 'approved', is_published: true,
    }).returning();
    const [legacyComment] = await db.insert(comments).values({
      post_id: legacyPost!.id, author_id: author.id,
      content: '<p>Legacy comment</p><img src="data:text/html,evil" onerror="alert(1)">',
    }).returning();

    const postResponse = await request(`/posts/${legacyPost!.slug}`);
    expect(postResponse.status).toBe(200);
    const postBody = await postResponse.json();
    expectSafeHtml(postBody.content);
    expect(postBody.content).toContain('Legacy text');
    expect(postBody.images).not.toContain('javascript:alert(1)');

    const commentsResponse = await request(`/posts/${legacyPost!.id}/comments`);
    expect(commentsResponse.status).toBe(200);
    const commentsBody = await commentsResponse.json();
    expectSafeHtml(commentsBody[0].content);
    expect(commentsBody[0].content).toContain('Legacy comment');
    expect(commentsBody[0].id).toBe(legacyComment!.id);
  });
});
