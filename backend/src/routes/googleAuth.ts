import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { settings } from '../core/config.js';
import { hashPassword } from '../core/security.js';
import { badRequest } from '../core/errors.js';

/**
 * Đăng nhập bằng Google — luồng authorization code chạy ở phía máy chủ.
 *
 * Client secret không bao giờ rời khỏi máy chủ này, nên trình duyệt không có
 * gì để lộ. Đổi lại là hai chặng chuyển hướng: /auth/google đưa người dùng
 * sang Google, Google gọi ngược về /auth/google/callback kèm một mã dùng một
 * lần, máy chủ đổi mã đó lấy id_token.
 *
 * Kết thúc, callback đặt đúng cookie refresh token mà đăng nhập bằng mật khẩu
 * vẫn dùng rồi trả người dùng về chỗ họ đứng. Không có token nào đi qua thanh
 * địa chỉ — thứ nằm trong URL thì nằm luôn trong lịch sử duyệt web, trong log
 * của proxy, và trong header Referer gửi sang trang khác.
 */

const STATE_COOKIE = 'mv_oauth';
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

export function googleEnabled(): boolean {
  return Boolean(settings.GOOGLE_CLIENT_ID && settings.GOOGLE_CLIENT_SECRET);
}

const trimSlash = (value: string) => value.replace(/\/+$/, '');

/**
 * Chỉ cho quay về hai tên miền của chính mình.
 *
 * Thiếu bước này thì ?next=https://trang-lua-dao biến trang đăng nhập thành
 * một open redirect: nạn nhân thấy đúng medicvn.com, đăng nhập thật, rồi bị
 * hất sang chỗ khác ngay sau đó.
 */
function safeNext(raw: string | undefined): string {
  const fallback = trimSlash(settings.PORTAL_URL) || '/';
  if (!raw) return fallback;
  try {
    const url = new URL(raw);
    const allowed = [settings.PORTAL_URL, settings.FORUM_URL]
      .filter(Boolean)
      .map((origin) => new URL(origin).origin);
    if (allowed.includes(url.origin)) return url.toString();
  } catch {
    /* không phải URL tuyệt đối hợp lệ */
  }
  return fallback;
}

/**
 * Đọc phần payload của id_token.
 *
 * Không kiểm chữ ký, và đó là chủ ý: token này vừa được lấy trực tiếp từ
 * endpoint của Google qua TLS, trong một request do chính máy chủ này khởi
 * tạo — không có bên thứ ba nào chen được vào giữa. (Chỉ khi id_token đến từ
 * trình duyệt thì mới bắt buộc phải kiểm chữ ký.)
 */
function readIdToken(idToken: string): Record<string, unknown> | null {
  const part = idToken.split('.')[1];
  if (!part) return null;
  try {
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Tên đăng nhập gợi ý từ email, đã bỏ ký tự lạ. */
function usernameSeed(email: string): string {
  const base = email.split('@')[0]?.toLowerCase().replace(/[^a-z0-9._-]/g, '') ?? '';
  return base.length >= 3 ? base.slice(0, 24) : `user${Date.now().toString(36).slice(-6)}`;
}

async function uniqueUsername(seed: string): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const candidate = attempt === 0 ? seed : `${seed}${Math.floor(Math.random() * 10000)}`;
    const taken = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, candidate))
      .limit(1);
    if (taken.length === 0) return candidate;
  }
  return `${seed}${randomUUID().slice(0, 8)}`;
}

/** GET /auth/google — dựng URL đồng ý của Google rồi đẩy người dùng sang đó. */
export function googleStart(c: Context) {
  if (!googleEnabled()) {
    throw badRequest('Google sign-in chưa được cấu hình trên máy chủ này.');
  }

  const next = safeNext(c.req.query('next'));
  const nonce = randomUUID();

  // State chống CSRF: giá trị ngẫu nhiên đặt trong cookie và gửi kèm sang
  // Google; callback chỉ chấp nhận khi hai bên khớp nhau. Nơi cần quay về đi
  // chung trong cookie đó, để không phải tin vào tham số trên URL.
  setCookie(c, STATE_COOKIE, `${nonce}|${next}`, {
    httpOnly: true,
    secure: settings.NODE_ENV === 'production',
    // Lax: Google trả người dùng về bằng một điều hướng GET ở cấp cao nhất,
    // đúng trường hợp Lax vẫn gửi cookie. Strict thì cookie không đi kèm và
    // mọi lần đăng nhập đều hỏng.
    sameSite: 'Lax',
    path: '/',
    domain: settings.COOKIE_DOMAIN || undefined,
    maxAge: 600,
  });

  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set('client_id', settings.GOOGLE_CLIENT_ID);
  url.searchParams.set('redirect_uri', settings.GOOGLE_REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', nonce);
  url.searchParams.set('prompt', 'select_account');
  return c.redirect(url.toString());
}

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
}

async function exchangeCode(code: string): Promise<GoogleProfile | null> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: settings.GOOGLE_CLIENT_ID,
      client_secret: settings.GOOGLE_CLIENT_SECRET,
      redirect_uri: settings.GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) {
    console.warn('[google] token exchange failed', res.status, await res.text());
    return null;
  }

  const data = (await res.json()) as { id_token?: string };
  if (!data.id_token) return null;

  const claims = readIdToken(data.id_token);
  if (!claims) return null;

  // aud phải là chính client này: một id_token cấp cho ứng dụng khác vẫn có
  // chữ ký hợp lệ của Google.
  if (claims.aud !== settings.GOOGLE_CLIENT_ID) {
    console.warn('[google] id_token audience mismatch');
    return null;
  }
  const sub = typeof claims.sub === 'string' ? claims.sub : null;
  const email = typeof claims.email === 'string' ? claims.email.toLowerCase() : null;
  if (!sub || !email) return null;

  return {
    sub,
    email,
    emailVerified: claims.email_verified === true,
    name: typeof claims.name === 'string' ? claims.name : null,
    picture: typeof claims.picture === 'string' ? claims.picture : null,
  };
}

/**
 * Tìm hoặc tạo tài khoản cho một hồ sơ Google, rồi trả về hàng trong bảng
 * users. Đây là chỗ "lưu vào DB" mà mọi lần đăng nhập Google đều đi qua.
 */
export async function upsertGoogleUser(profile: GoogleProfile) {
  const bySub = await db
    .select()
    .from(users)
    .where(eq(users.google_sub, profile.sub))
    .limit(1);
  let user = bySub[0];

  if (!user) {
    // Chưa từng đăng nhập bằng Google, nhưng có thể đã có tài khoản mật khẩu
    // cùng email. Gắn hai thứ vào làm một thay vì đẻ ra tài khoản thứ hai —
    // chỉ khi Google xác nhận email, nếu không thì bất kỳ ai đăng ký một địa
    // chỉ Gmail giả cũng chiếm được tài khoản người khác.
    const byEmail = await db.select().from(users).where(eq(users.email, profile.email)).limit(1);
    const existing = byEmail[0];

    if (existing && profile.emailVerified) {
      const updated = await db
        .update(users)
        .set({
          google_sub: profile.sub,
          email_verified: true,
          avatar_url: existing.avatar_url ?? profile.picture,
          full_name: existing.full_name ?? profile.name,
          updated_at: new Date(),
        })
        .where(eq(users.id, existing.id))
        .returning();
      user = updated[0];
    } else if (existing) {
      return { user: null as null, reason: 'email_unverified' as const };
    } else {
      const username = await uniqueUsername(usernameSeed(profile.email));
      const inserted = await db
        .insert(users)
        .values({
          email: profile.email,
          username,
          full_name: profile.name ?? username,
          avatar_url: profile.picture,
          google_sub: profile.sub,
          email_verified: profile.emailVerified,
          // Không có mật khẩu nào để lưu. Một chuỗi băm của giá trị ngẫu
          // nhiên giữ cột NOT NULL nguyên vẹn và không bao giờ khớp với bất
          // kỳ mật khẩu nào người dùng gõ vào.
          hashed_password: await hashPassword(`${randomUUID()}${randomUUID()}`),
        })
        .returning();
      user = inserted[0];
    }
  } else if (profile.picture && !user.avatar_url) {
    const updated = await db
      .update(users)
      .set({ avatar_url: profile.picture, updated_at: new Date() })
      .where(eq(users.id, user.id))
      .returning();
    user = updated[0];
  }

  if (!user) return { user: null as null, reason: 'create_failed' as const };
  if (!user.is_active) return { user: null as null, reason: 'inactive' as const };
  return { user, reason: null };
}

/**
 * GET /auth/google/callback.
 *
 * `issue` được truyền vào từ auth.ts để dùng lại đúng hàm phát cookie refresh
 * token của đăng nhập thường — hai đường vào, một cách cấp phiên.
 */
export function makeGoogleCallback(issue: (c: Context, id: string, role: string) => Promise<unknown>) {
  return async (c: Context) => {
    const raw = getCookie(c, STATE_COOKIE);
    deleteCookie(c, STATE_COOKIE, { path: '/', domain: settings.COOKIE_DOMAIN || undefined });

    const [nonce, storedNext] = (raw ?? '').split('|');
    const back = safeNext(storedNext);
    const fail = (reason: string) =>
      c.redirect(`${trimSlash(settings.PORTAL_URL)}/login?error=${reason}`);

    if (!googleEnabled()) return fail('google_disabled');

    const code = c.req.query('code');
    const state = c.req.query('state');
    if (c.req.query('error')) return fail('google_cancelled');
    // So sánh state trước khi đụng tới code: đây là bước chặn CSRF.
    if (!code || !state || !nonce || state !== nonce) return fail('google_state');

    try {
      const profile = await exchangeCode(code);
      if (!profile) return fail('google_token');

      const { user, reason } = await upsertGoogleUser(profile);
      if (!user) return fail(reason === 'inactive' ? 'account_disabled' : 'google_link');

      await issue(c, user.id, user.role);
      return c.redirect(back);
    } catch (err) {
      console.error('[google] callback failed', err);
      return fail('google_failed');
    }
  };
}
