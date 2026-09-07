import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/index.js';
import { users } from '../src/db/schema.js';
import { closeDatabase, freshDatabase, json, request, seedUser, type SeededUser } from './setup.js';

/**
 * Đăng nhập một lần cho hai tên miền.
 *
 * Diễn đàn tách sang forums.medicvn.com nhưng không giữ mật khẩu và không có
 * localStorage chung với trang mẹ. Toàn bộ cơ chế nằm ở cookie refresh token
 * đặt ở tên miền cha, nên những gì kiểm ở đây chính là thứ giữ cho người dùng
 * không phải đăng nhập lại — và là thứ cắt quyền khi tài khoản bị khoá.
 */

let ip = 0;
const nextIp = () => ({ 'x-forwarded-for': `10.60.${Math.floor(ip / 250)}.${ip++ % 250}` });

let member: SeededUser;

beforeAll(async () => {
  await freshDatabase();
  member = await seedUser('user');
});

afterAll(async () => {
  await closeDatabase();
});

/** Tách một thuộc tính ra khỏi chuỗi Set-Cookie. */
function cookieAttr(setCookie: string, name: string): string | null {
  const found = setCookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.toLowerCase().startsWith(name.toLowerCase()));
  if (!found) return null;
  const eq = found.indexOf('=');
  return eq < 0 ? '' : found.slice(eq + 1);
}

async function login() {
  const res = await request('/auth/login', {
    method: 'POST',
    headers: nextIp(),
    body: json({ email: member.email, password: member.password }),
  });
  expect(res.status).toBe(200);
  const setCookie = res.headers.get('set-cookie');
  expect(setCookie).toBeTruthy();
  return { body: await res.json(), setCookie: setCookie! };
}

describe('SSO cookie giữa trang tin và diễn đàn', () => {
  it('đăng nhập đặt cookie refresh token, HttpOnly và đúng đường dẫn hẹp', async () => {
    const { setCookie } = await login();

    expect(setCookie).toContain('mv_rt=');
    // JavaScript của trang không đọc được: một lỗ XSS cũng không lấy được
    // tấm vé sống 7 ngày.
    expect(setCookie.toLowerCase()).toContain('httponly');
    // Không bám theo mọi request ảnh và bài viết.
    expect(cookieAttr(setCookie, 'Path')).toBe('/api/v1/auth');
    expect(setCookie).toContain('SameSite=Lax');
  });

  it('làm mới được token khi CHỈ có cookie, không có body — đây là lúc người dùng vừa sang diễn đàn', async () => {
    const { setCookie } = await login();

    const res = await request('/auth/refresh', {
      method: 'POST',
      headers: { ...nextIp(), cookie: setCookie.split(';')[0]! },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.access_token).toBe('string');
    // Cấp lại cookie mới, nên phiên trượt theo mỗi lần dùng.
    expect(res.headers.get('set-cookie')).toContain('mv_rt=');
  });

  it('vẫn nhận refresh token trong body — bản client cũ không gãy', async () => {
    const { body } = await login();

    const res = await request('/auth/refresh', {
      method: 'POST',
      headers: nextIp(),
      body: json({ refresh_token: body.refresh_token }),
    });

    expect(res.status).toBe(200);
  });

  it('không cookie, không body thì 401 chứ không phải lỗi 500', async () => {
    const res = await request('/auth/refresh', { method: 'POST', headers: nextIp() });
    expect(res.status).toBe(401);
  });

  it('cookie mang access token bị từ chối, và cookie đó bị xoá luôn', async () => {
    const { body } = await login();

    const res = await request('/auth/refresh', {
      method: 'POST',
      headers: { ...nextIp(), cookie: `mv_rt=${body.access_token}` },
    });

    expect(res.status).toBe(401);
    // Max-Age=0: thôi gửi lại một thứ chắc chắn không dùng được nữa.
    expect(res.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('khoá tài khoản là cắt được phiên ngay, không chờ hết 7 ngày', async () => {
    const { setCookie } = await login();
    await db.update(users).set({ is_active: false }).where(eq(users.id, member.id));

    const res = await request('/auth/refresh', {
      method: 'POST',
      headers: { ...nextIp(), cookie: setCookie.split(';')[0]! },
    });

    expect(res.status).toBe(403);
    expect(res.headers.get('set-cookie')).toContain('Max-Age=0');

    await db.update(users).set({ is_active: true }).where(eq(users.id, member.id));
  });

  it('đăng xuất xoá cookie ở tên miền cha, tức là thoát cả hai trang', async () => {
    const res = await request('/auth/logout', { method: 'POST', headers: nextIp() });

    expect(res.status).toBe(204);
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toContain('mv_rt=');
    expect(setCookie).toContain('Max-Age=0');
    expect(cookieAttr(setCookie!, 'Path')).toBe('/api/v1/auth');
  });
});
