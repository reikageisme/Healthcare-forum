import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { SignJWT, jwtVerify } from 'jose';
import { settings } from '../src/core/config.js';
import { createAccessToken, createRefreshToken } from '../src/core/security.js';
import { db } from '../src/db/index.js';
import { posts, users } from '../src/db/schema.js';
import { closeDatabase, freshDatabase, json, request, seedUser, type SeededUser } from './setup.js';

const signingKey = new TextEncoder().encode(settings.JWT_SECRET);
let ip = 0;
const nextIp = () => ({ 'x-forwarded-for': `10.20.${Math.floor(ip / 250)}.${ip++ % 250}` });

let owner: SeededUser;
let publicPostId: string;
let pendingPostId: string;

beforeAll(async () => {
  await freshDatabase();
  owner = await seedUser('admin');
  const inserted = await db.insert(posts).values([
    {
      title: 'Public anonymous auth fixture',
      slug: 'g2-public-auth-fixture',
      content: '<p>Public content.</p>',
      author_id: owner.id,
      status: 'approved',
      is_published: true,
      is_anonymous: true,
    },
    {
      title: 'Pending auth fixture',
      slug: 'g2-pending-auth-fixture',
      content: '<p>Private content.</p>',
      author_id: owner.id,
      status: 'pending',
      is_published: false,
    },
  ]).returning();
  publicPostId = inserted[0]!.id;
  pendingPostId = inserted[1]!.id;
});

afterEach(() => {
  vi.useRealTimers();
});

afterAll(async () => {
  await closeDatabase();
});

// Sign independently of the production helpers so malformed claims are real,
// correctly signed JWTs rather than mocked decoder results.
function signedToken(
  sub: string,
  type: 'access' | 'refresh',
  overrides: Record<string, unknown> = {},
  algorithm = settings.JWT_ALGORITHM as string,
  key = signingKey,
) {
  return new SignJWT({
    sub,
    role: 'admin',
    type,
    exp: Math.floor(Date.now() / 1000) + 60,
    ...overrides,
  }).setProtectedHeader({ alg: algorithm }).sign(key);
}

async function expectError(response: Response, status: number, detail: string) {
  expect(response.status).toBe(status);
  expect(await response.json()).toEqual({ detail });
  if (status === 401) expect(response.headers.get('WWW-Authenticate')).toBe('Bearer');
}

async function expectTokenPair(response: Response, sub: string, role: string, status = 200) {
  expect(response.status).toBe(status);
  const body = await response.json();
  expect(Object.keys(body).sort()).toEqual(['access_token', 'refresh_token', 'token_type']);
  expect(body.token_type).toBe('bearer');
  expect(typeof body.access_token).toBe('string');
  expect(typeof body.refresh_token).toBe('string');
  expect(body.access_token).not.toBe(body.refresh_token);

  for (const [kind, token] of [
    ['access', body.access_token],
    ['refresh', body.refresh_token],
  ] as const) {
    const { payload } = await jwtVerify(token, signingKey, { algorithms: [settings.JWT_ALGORITHM] });
    expect(payload).toMatchObject({ sub, role, type: kind });
    expect(typeof payload.exp).toBe('number');
    expect(payload.exp!).toBeGreaterThan(Math.floor(Date.now() / 1000));
  }
  return body as { access_token: string; refresh_token: string; token_type: string };
}

async function refresh(token: string) {
  return request('/auth/refresh', {
    method: 'POST', headers: nextIp(), body: json({ refresh_token: token }),
  });
}

async function expectAnonymous(token: string) {
  const visible = await request(`/posts/${publicPostId}`, { token, headers: nextIp() });
  expect(visible.status).toBe(200);
  expect((await visible.json()).author.id).toBe('anonymous');
  await expectError(
    await request(`/posts/${pendingPostId}`, { token, headers: nextIp() }),
    404, 'Post not found',
  );
}

describe('G2 registration and login', () => {
  it('AUTH-01 registers a user and returns a usable token pair', async () => {
    const email = 'g2-register@test.vn';
    const response = await request('/auth/register', {
      method: 'POST', headers: nextIp(),
      body: json({ email, username: 'g2_register', password: 'CorrectHorse123!' }),
    });
    const [stored] = await db.select().from(users).where(eq(users.email, email));
    expect(stored).toBeDefined();
    const pair = await expectTokenPair(response, stored!.id, 'user', 201);
    const me = await request('/auth/me', { token: pair.access_token, headers: nextIp() });
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({ id: stored!.id, email, role: 'user', is_active: true });
  });

  it.each(['email', 'username'] as const)('AUTH-02 refuses a duplicate %s without inserting a user', async (field) => {
    const existing = await seedUser('user');
    const before = await db.select().from(users).orderBy(users.id);
    const response = await request('/auth/register', {
      method: 'POST', headers: nextIp(),
      body: json({
        email: `g2-${randomUUID()}@test.vn`,
        username: `g2_${randomUUID()}`,
        password: 'CorrectHorse123!',
        [field]: existing[field],
      }),
    });
    await expectError(response, 400, 'User with this email or username already exists');
    expect(await db.select().from(users).orderBy(users.id)).toEqual(before);
  });

  it('AUTH-02 maps a concurrent duplicate registration to the stable 400 contract', async () => {
    const email = `g2-concurrent-${randomUUID()}@test.vn`;
    const username = `g2_concurrent_${randomUUID()}`;
    const body = json({ email, username, password: 'CorrectHorse123!' });

    const responses = await Promise.all([
      request('/auth/register', { method: 'POST', headers: nextIp(), body }),
      request('/auth/register', { method: 'POST', headers: nextIp(), body }),
    ]);
    const statuses = responses.map((response) => response.status).sort();
    expect(statuses).toEqual([201, 400]);

    const duplicate = responses.find((response) => response.status === 400)!;
    expect(await duplicate.json()).toEqual({
      detail: 'User with this email or username already exists',
    });
    expect(await db.select().from(users).where(eq(users.email, email))).toHaveLength(1);
  });

  it('AUTH-03 logs in an active user with the correct token kinds', async () => {
    const user = await seedUser('doctor');
    const response = await request('/auth/login', {
      method: 'POST', headers: nextIp(), body: json({ email: user.email, password: user.password }),
    });
    await expectTokenPair(response, user.id, 'doctor');
  });

  it.each(['unknown account', 'wrong password'])('rejects %s with the same credential error', async (scenario) => {
    const response = await request('/auth/login', {
      method: 'POST', headers: nextIp(),
      body: json({
        email: scenario === 'unknown account' ? 'g2-missing@test.vn' : owner.email,
        password: 'wrong-password',
      }),
    });
    await expectError(response, 401, 'Incorrect email or password');
  });

  it('AUTH-04 refuses inactive login without returning tokens', async () => {
    const user = await seedUser('user');
    await db.update(users).set({ is_active: false }).where(eq(users.id, user.id));
    await expectError(await request('/auth/login', {
      method: 'POST', headers: nextIp(), body: json({ email: user.email, password: user.password }),
    }), 403, 'Account has been deactivated');
  });
});

const invalidClaims: { name: string; claims: Record<string, unknown> }[] = [
  { name: 'missing token type (legacy session)', claims: { type: undefined } },
  { name: 'unknown token type', claims: { type: 'session' } },
  { name: 'uppercase token type', claims: { type: 'ACCESS' } },
  { name: 'array token type', claims: { type: ['access'] } },
  { name: 'null token type', claims: { type: null } },
  { name: 'missing subject', claims: { sub: undefined } },
  { name: 'empty subject', claims: { sub: '' } },
  { name: 'malformed UUID subject', claims: { sub: 'not-a-uuid' } },
  { name: 'numeric subject', claims: { sub: 123 } },
  { name: 'object subject', claims: { sub: { id: 'not-a-uuid' } } },
  { name: 'missing expiry', claims: { exp: undefined } },
  { name: 'expired token', claims: { exp: 1 } },
  { name: 'string expiry', claims: { exp: '4102444800' } },
  { name: 'null expiry', claims: { exp: null } },
  { name: 'future not-before', claims: { nbf: 4102444800 } },
];

describe('G2 credential validation', () => {
  it.each(invalidClaims)('AUTH-05 rejects $name at both credential boundaries', async ({ claims }) => {
    const access = await signedToken(owner.id, 'access', claims);
    const renewal = await signedToken(owner.id, 'refresh', claims);
    await expectError(
      await request('/auth/me', { token: access, headers: nextIp() }),
      401, 'Could not validate credentials',
    );
    await expectError(await refresh(renewal), 401, 'Invalid refresh token');
  });

  it.each(invalidClaims)('AUTH-09 treats $name as anonymous on public routes', async ({ claims }) => {
    await expectAnonymous(await signedToken(owner.id, 'access', claims));
  });

  it.each(['malformed JWT', 'wrong signature', 'wrong algorithm'])('rejects a %s and preserves anonymous reads', async (scenario) => {
    async function credential(kind: 'access' | 'refresh') {
      if (scenario === 'malformed JWT') return 'not.a.valid-jwt';
      if (scenario === 'wrong signature') {
        return signedToken(owner.id, kind, {}, settings.JWT_ALGORITHM,
          new TextEncoder().encode('g2-independent-test-key-not-used-by-the-app'));
      }
      return signedToken(owner.id, kind, {}, 'HS384');
    }
    const access = await credential('access');
    await expectError(await request('/auth/me', { token: access }), 401, 'Could not validate credentials');
    await expectError(await refresh(await credential('refresh')), 401, 'Invalid refresh token');
    await expectAnonymous(access);
  });

  it.each([undefined, 'Basic credentials', 'Bearer   '])('rejects an unusable Authorization header: %s', async (authorization) => {
    const headers = authorization === undefined ? {} : { Authorization: authorization };
    await expectError(await request('/auth/me', { headers }), 401, 'Not authenticated');
  });

  it('AUTH-06 refuses an access token at the refresh endpoint', async () => {
    await expectError(await refresh(owner.token), 401, 'Invalid refresh token');
  });

  it('refuses a refresh bearer on protected routes and treats it as anonymous on public routes', async () => {
    const token = await createRefreshToken(owner.id, owner.role);
    await expectError(await request('/auth/me', { token }), 401, 'Could not validate credentials');
    await expectAnonymous(token);
  });

  it('keeps previously issued typed tokens without iat or jti usable', async () => {
    const token = await signedToken(owner.id, 'access');
    const me = await request('/auth/me', { token, headers: nextIp() });
    expect(me.status).toBe(200);
    expect((await me.json()).id).toBe(owner.id);
    const privatePost = await request(`/posts/${pendingPostId}`, { token, headers: nextIp() });
    expect(privatePost.status).toBe(200);
    const visible = await request(`/posts/${publicPostId}`, { token, headers: nextIp() });
    expect((await visible.json()).author.id).toBe(owner.id);
    await expectTokenPair(await refresh(await signedToken(owner.id, 'refresh')), owner.id, owner.role);
  });
});

describe('G2 refresh and account lifecycle', () => {
  it('AUTH-07 returns distinct token pairs when refreshing within the same second', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(Math.floor(Date.now() / 1000) * 1000));
    const first = await expectTokenPair(await request('/auth/login', {
      method: 'POST', headers: nextIp(), body: json({ email: owner.email, password: owner.password }),
    }), owner.id, owner.role);
    const second = await expectTokenPair(await refresh(first.refresh_token), owner.id, owner.role);
    const third = await expectTokenPair(await refresh(second.refresh_token), owner.id, owner.role);

    expect(new Set([first.access_token, second.access_token, third.access_token]).size).toBe(3);
    expect(new Set([first.refresh_token, second.refresh_token, third.refresh_token]).size).toBe(3);
    const ids: string[] = [];
    for (const pair of [first, second, third]) {
      for (const [kind, token] of [['access', pair.access_token], ['refresh', pair.refresh_token]] as const) {
        const { payload } = await jwtVerify(token, signingKey);
        expect(payload.iat).toBe(Math.floor(Date.now() / 1000));
        const lifetime = kind === 'access'
          ? settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
          : settings.REFRESH_TOKEN_EXPIRE_DAYS * 86_400;
        expect(payload.exp! - payload.iat!).toBe(lifetime);
        expect(payload.jti).toMatch(/^[0-9a-f-]{36}$/);
        ids.push(payload.jti!);
      }
    }
    expect(new Set(ids).size).toBe(6);
    const me = await request('/auth/me', { token: third.access_token });
    expect(me.status).toBe(200);
    expect((await me.json()).id).toBe(owner.id);
  });

  it('AUTH-08 stops access and refresh immediately after deactivation; optional auth becomes anonymous', async () => {
    const token = await createRefreshToken(owner.id, owner.role);
    await db.update(users).set({ is_active: false }).where(eq(users.id, owner.id));
    try {
      await expectError(await request('/auth/me', { token: owner.token }), 403, 'Inactive user');
      await expectError(await refresh(token), 403, 'Account has been deactivated');
      await expectAnonymous(owner.token);
    } finally {
      await db.update(users).set({ is_active: true }).where(eq(users.id, owner.id));
    }
  });

  it('rejects deleted accounts even while their signed credentials remain unexpired', async () => {
    const user = await seedUser('user');
    const token = await createRefreshToken(user.id, user.role);
    await db.delete(users).where(eq(users.id, user.id));
    await expectError(await request('/auth/me', { token: user.token }), 401, 'Could not validate credentials');
    await expectError(await refresh(token), 401, 'User not found');
    await expectAnonymous(user.token);
  });

  it.each([
    { initial: 'admin', updated: 'user', status: 403 },
    { initial: 'user', updated: 'moderator', status: 200 },
  ] as const)('uses the database role immediately after $initial becomes $updated', async ({ initial, updated, status }) => {
    const user = await seedUser(initial);
    const access = await createAccessToken(user.id, initial);
    const renewal = await createRefreshToken(user.id, initial);
    await db.update(users).set({ role: updated }).where(eq(users.id, user.id));
    const me = await request('/auth/me', { token: access, headers: nextIp() });
    expect(me.status).toBe(200);
    expect((await me.json()).role).toBe(updated);
    const admin = await request('/admin/stats', { token: access, headers: nextIp() });
    expect(admin.status).toBe(status);
    if (status === 403) expect(await admin.json()).toEqual({ detail: 'Not enough permissions' });
    await expectTokenPair(await refresh(renewal), user.id, updated);
  });
});
