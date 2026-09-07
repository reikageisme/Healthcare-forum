import { Hono } from 'hono';
import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { eq, or } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import {
  createAccessToken,
  createRefreshToken,
  decodeToken,
  hashPassword,
  verifyPassword,
} from '../core/security.js';
import { badRequest, forbidden, unauthorized } from '../core/errors.js';
import { parseBody } from '../lib/validate.js';
import { userCreateSchema, userLoginSchema } from '../schemas/requests.js';
import { settings } from '../core/config.js';
import { toUserResponse, tokenResponseSchema } from '../schemas/responses.js';
import { requireAuth, currentUser } from '../middleware/auth.js';
import { loginRateLimit, registerRateLimit } from '../middleware/rateLimit.js';
import { sanitizePlainText } from '../lib/sanitize.js';

export const authRoutes = new Hono();

const duplicateUserDetail = 'User with this email or username already exists';

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error
    && (error as { code?: unknown }).code === '23505';
}

/**
 * Cookie giữ refresh token, dùng chung cho trang tin và diễn đàn.
 *
 * Trước đây refresh token chỉ nằm trong localStorage của trình duyệt, mà
 * localStorage gắn chặt với một origin: forums.medicvn.com không có cách nào
 * đọc được phiên đăng nhập của medicvn.com. Cookie đặt ở tên miền cha
 * (.medicvn.com) thì cả hai tên miền cùng gửi kèm nó, nên người dùng chỉ phải
 * đăng nhập một lần.
 *
 * HttpOnly: JavaScript của trang không đọc được, nên một lỗ XSS cũng không
 * lấy được refresh token 7 ngày. Path hẹp: cookie chỉ đi kèm đúng các
 * endpoint xác thực, không bám theo mọi request ảnh và bài viết.
 */
const REFRESH_COOKIE = 'mv_rt';
const REFRESH_COOKIE_PATH = '/api/v1/auth';

function setRefreshCookie(c: Context, token: string) {
  setCookie(c, REFRESH_COOKIE, token, {
    httpOnly: true,
    // Trên http của môi trường phát triển, cờ Secure khiến trình duyệt bỏ
    // cookie đi mà không báo gì.
    secure: settings.NODE_ENV === 'production',
    sameSite: 'Lax',
    path: REFRESH_COOKIE_PATH,
    domain: settings.COOKIE_DOMAIN || undefined,
    maxAge: settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
  });
}

function clearRefreshCookie(c: Context) {
  deleteCookie(c, REFRESH_COOKIE, {
    path: REFRESH_COOKIE_PATH,
    domain: settings.COOKIE_DOMAIN || undefined,
  });
}

async function issueTokens(c: Context, id: string, role: string) {
  const [access_token, refresh_token] = await Promise.all([
    createAccessToken(id, role),
    createRefreshToken(id, role),
  ]);
  setRefreshCookie(c, refresh_token);
  // Refresh token vẫn trả trong body: bản client cũ còn đọc nó, và trình
  // duyệt nào chặn cookie thì vẫn đăng nhập được như trước.
  return tokenResponseSchema.parse({
    access_token,
    refresh_token,
    token_type: 'bearer',
  });
}

authRoutes.post('/register', registerRateLimit, async (c) => {
  const body = await parseBody(c, userCreateSchema);

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(or(eq(users.email, body.email), eq(users.username, body.username)))
    .limit(1);
  if (existing.length > 0) {
    throw badRequest(duplicateUserDetail);
  }

  let inserted;
  try {
    inserted = await db
      .insert(users)
      .values({
        email: body.email,
        username: body.username,
        full_name: body.full_name ?? null,
        hashed_password: await hashPassword(body.password),
      })
      .returning();
  } catch (error) {
    // The pre-check avoids an unnecessary bcrypt hash for ordinary duplicate
    // submissions; the unique index remains the authority for concurrent ones.
    if (isUniqueViolation(error)) throw badRequest(duplicateUserDetail);
    throw error;
  }

  const user = inserted[0];
  if (!user) throw badRequest('Could not create user');
  return c.json(await issueTokens(c, user.id, user.role), 201);
});

authRoutes.post('/login', loginRateLimit, async (c) => {
  const body = await parseBody(c, userLoginSchema);

  const rows = await db.select().from(users).where(eq(users.email, body.email)).limit(1);
  const user = rows[0];

  // Same message and status for "no such account" and "wrong password", so
  // the endpoint cannot be used to enumerate registered emails.
  if (!user || !(await verifyPassword(body.password, user.hashed_password))) {
    throw unauthorized('Incorrect email or password');
  }
  if (!user.is_active) throw forbidden('Account has been deactivated');

  return c.json(await issueTokens(c, user.id, user.role));
});

/**
 * Đổi refresh token lấy cặp token mới.
 *
 * Token đến từ một trong hai chỗ: body (client cũ, và khi trình duyệt chặn
 * cookie) hoặc cookie mv_rt — đường duy nhất khi người dùng vừa từ trang tin
 * bước sang diễn đàn. Body được ưu tiên vì đó là lựa chọn tường minh của
 * client. Đến từ đâu thì token cũng qua đúng một cửa kiểm chữ ký ở decodeToken.
 */
authRoutes.post('/refresh', async (c) => {
  let bodyToken: string | undefined;
  try {
    const raw = (await c.req.json()) as unknown;
    if (
      raw &&
      typeof raw === 'object' &&
      typeof (raw as { refresh_token?: unknown }).refresh_token === 'string'
    ) {
      bodyToken = (raw as { refresh_token: string }).refresh_token;
    }
  } catch {
    // Không có body, hoặc body không phải JSON: rơi xuống dùng cookie.
  }

  const token = bodyToken ?? getCookie(c, REFRESH_COOKIE);
  if (!token) throw unauthorized('Missing refresh token');

  const payload = await decodeToken(token, 'refresh');
  if (!payload) {
    // Cookie hỏng hoặc hết hạn thì xoá luôn, để trình duyệt thôi gửi lại một
    // thứ chắc chắn không dùng được nữa.
    clearRefreshCookie(c);
    throw unauthorized('Invalid refresh token');
  }

  const rows = await db.select().from(users).where(eq(users.id, payload.sub)).limit(1);
  const user = rows[0];
  if (!user) {
    clearRefreshCookie(c);
    throw unauthorized('User not found');
  }
  if (!user.is_active) {
    // Tài khoản bị khoá mà cookie còn sống 7 ngày thì người đó vẫn đăng bài
    // ở diễn đàn được cả tuần. Cắt ngay tại đây.
    clearRefreshCookie(c);
    throw forbidden('Account has been deactivated');
  }

  return c.json(await issueTokens(c, user.id, user.role));
});

/**
 * Đăng xuất. Cookie nằm ở tên miền cha nên xoá một lần là thoát cả hai trang;
 * access token chỉ sống trong bộ nhớ tab nên tự mất.
 */
authRoutes.post('/logout', (c) => {
  clearRefreshCookie(c);
  return c.body(null, 204);
});

authRoutes.get('/me', requireAuth, async (c) => {
  return c.json(toUserResponse(currentUser(c)));
});

