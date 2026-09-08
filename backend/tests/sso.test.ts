import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/index.js';
import { users } from '../src/db/schema.js';
import { settings } from '../src/core/config.js';
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


/**
 * Đăng nhập bằng Google phải cho ra ĐÚNG cái phiên mà đăng nhập bằng mật khẩu
 * cho ra — không thì trang tin nhận ra người dùng còn diễn đàn thì không.
 *
 * Chỗ dễ hỏng nằm ở chi tiết: c.redirect() tạo một Response mới, và nếu nó
 * đánh rơi header Set-Cookie thì cookie phiên không bao giờ tới trình duyệt.
 * Trang tin vẫn "có vẻ" đăng nhập được vì nó tự giữ access token trong
 * localStorage; diễn đàn thì chỉ có mỗi cookie để dựa vào, nên nó là nơi lỗi
 * đó lộ ra.
 */
describe('đăng nhập Google dùng chung phiên với diễn đàn', () => {
  const CLIENT_ID = 'test-client.apps.googleusercontent.com';

  const idToken = (claims: Record<string, unknown>) =>
    ['e30', Buffer.from(JSON.stringify(claims)).toString('base64url'), 'sig'].join('.');

  const startFlow = async () => {
    settings.GOOGLE_CLIENT_ID = CLIENT_ID;
    settings.GOOGLE_CLIENT_SECRET = 'test-secret';
    settings.GOOGLE_REDIRECT_URI = 'https://medicvn.com/api/auth/google/callback';
    settings.COOKIE_DOMAIN = '.medicvn.com';

    const next = `${settings.FORUM_URL}/posts/abc`;
    const res = await request(`/auth/google?next=${encodeURIComponent(next)}`, {
      headers: nextIp(),
    });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('accounts.google.com');

    const stateCookie = res.headers.get('set-cookie') ?? '';
    const raw = decodeURIComponent(stateCookie.split(';')[0]!.replace('mv_oauth=', ''));
    return { nonce: raw.split('|')[0]!, cookie: stateCookie.split(';')[0]!, next };
  };

  afterEach(() => {
    vi.unstubAllGlobals();
    settings.COOKIE_DOMAIN = '';
  });

  it('callback đặt cookie phiên ở tên miền cha và trả người dùng về đúng thớt bên diễn đàn', async () => {
    const { nonce, cookie, next } = await startFlow();

    vi.stubGlobal('fetch', async () =>
      new Response(
        JSON.stringify({
          id_token: idToken({
            aud: CLIENT_ID,
            sub: 'google-sub-1',
            email: 'nguoimoi@gmail.com',
            email_verified: true,
            name: 'Người Mới',
          }),
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const res = await request(`/auth/google/callback?code=abc&state=${nonce}`, {
      headers: { ...nextIp(), cookie },
    });

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(next);

    // Response nay mang HAI cookie: mot cai xoa state, mot cai la phien.
    // Phai tach dung cai mv_rt ra roi moi doc thuoc tinh cua no.
    const setCookie = (res.headers.get('set-cookie') ?? '')
      .split(/,\s*(?=[A-Za-z_-]+=)/)
      .find((part) => part.startsWith('mv_rt='))!;
    expect(setCookie).toBeTruthy();
    // Đúng ba thuộc tính này mới là thứ khiến forums.medicvn.com nhận ra phiên.
    expect(cookieAttr(setCookie, 'Domain')).toBe('.medicvn.com');
    expect(cookieAttr(setCookie, 'Path')).toBe('/api/v1/auth');
    expect(setCookie.toLowerCase()).toContain('httponly');
  });

  it('diễn đàn đổi được cookie đó lấy access token, không cần body', async () => {
    const { nonce, cookie } = await startFlow();

    vi.stubGlobal('fetch', async () =>
      new Response(
        JSON.stringify({
          id_token: idToken({
            aud: CLIENT_ID,
            sub: 'google-sub-2',
            email: 'bacsigoogle@gmail.com',
            email_verified: true,
          }),
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const callback = await request(`/auth/google/callback?code=abc&state=${nonce}`, {
      headers: { ...nextIp(), cookie },
    });
    const session = (callback.headers.get('set-cookie') ?? '')
      .split(/,\s*(?=[A-Za-z_-]+=)/)
      .find((part) => part.startsWith('mv_rt='))!
      .split(';')[0]!;

    // Đây chính xác là request useSilentLogin gửi khi vừa mở forums.medicvn.com.
    const refreshed = await request('/auth/refresh', {
      method: 'POST',
      headers: { ...nextIp(), cookie: session },
    });
    expect(refreshed.status).toBe(200);
    expect((await refreshed.json()).access_token).toBeTruthy();

    const row = await db
      .select()
      .from(users)
      .where(eq(users.google_sub, 'google-sub-2'))
      .limit(1);
    expect(row[0]?.email).toBe('bacsigoogle@gmail.com');
    expect(row[0]?.email_verified).toBe(true);
  });

  it('state không khớp thì không cấp phiên nào', async () => {
    await startFlow();
    const res = await request('/auth/google/callback?code=abc&state=ke-gia-mao', {
      headers: nextIp(),
    });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('error=google_state');
    expect(res.headers.get('set-cookie') ?? '').not.toContain('mv_rt=');
  });
});
