import { Hono } from 'hono';
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
import { refreshSchema, userCreateSchema, userLoginSchema } from '../schemas/requests.js';
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
  const payload = await decodeToken(body.refresh_token, 'refresh');
  if (!payload) throw unauthorized('Invalid refresh token');

  const rows = await db.select().from(users).where(eq(users.id, payload.sub)).limit(1);
  const user = rows[0];
  if (!user) throw unauthorized('User not found');
  if (!user.is_active) throw forbidden('Account has been deactivated');

  return c.json(await issueTokens(user.id, user.role));
});

authRoutes.get('/me', requireAuth, async (c) => {
  return c.json(toUserResponse(currentUser(c)));
});

