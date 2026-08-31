import { Hono } from 'hono';
import { eq, or } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import {
  asUuid,
  createAccessToken,
  createRefreshToken,
  decodeToken,
  hashPassword,
  verifyPassword,
} from '../core/security.js';
import { badRequest, forbidden, unauthorized } from '../core/errors.js';
import { parseBody } from '../lib/validate.js';
import { refreshSchema, userCreateSchema, userLoginSchema } from '../schemas/requests.js';
import { toUserResponse, tokenResponseSchema } from '../schemas/responses.js';
import { requireAuth, currentUser } from '../middleware/auth.js';
import { loginRateLimit, registerRateLimit } from '../middleware/rateLimit.js';
import { sanitizePlainText } from '../lib/sanitize.js';

export const authRoutes = new Hono();

async function issueTokens(id: string, role: string) {
  const [access_token, refresh_token] = await Promise.all([
    createAccessToken(id, role),
    createRefreshToken(id, role),
  ]);
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
    throw badRequest('User with this email or username already exists');
  }

  const inserted = await db
    .insert(users)
    .values({
      email: body.email,
      username: body.username,
      full_name: body.full_name ?? null,
      hashed_password: await hashPassword(body.password),
    })
    .returning();

  const user = inserted[0];
  if (!user) throw badRequest('Could not create user');
  return c.json(await issueTokens(user.id, user.role), 201);
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

  return c.json(await issueTokens(user.id, user.role));
});

authRoutes.post('/refresh', async (c) => {
  const body = await parseBody(c, refreshSchema);
  const payload = await decodeToken(body.refresh_token);
  if (!payload) throw unauthorized('Invalid refresh token');

  // Access and refresh tokens carried identical payloads in the Python
  // implementation, so a stolen 30-minute access token could be traded for a
  // 7-day refresh token. Only a token minted as a refresh token is accepted.
  if (payload.type !== 'refresh') throw unauthorized('Invalid refresh token');

  // auth.py:54 compared a string subject against a uuid column, which raises
  // on Postgres. Validating the subject first is what fixes it.
  const userId = asUuid(payload.sub);
  if (!userId) throw unauthorized('Invalid refresh token');

  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = rows[0];
  if (!user) throw unauthorized('User not found');
  if (!user.is_active) throw forbidden('Account has been deactivated');

  return c.json(await issueTokens(user.id, user.role));
});

authRoutes.get('/me', requireAuth, async (c) => {
  return c.json(toUserResponse(currentUser(c)));
});

