import type { Context, MiddlewareHandler } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, type UserRow } from '../db/schema.js';
import { asUuid, decodeToken } from '../core/security.js';
import { forbidden, unauthorized } from '../core/errors.js';

export type Role = 'guest' | 'user' | 'doctor' | 'moderator' | 'admin';

declare module 'hono' {
  interface ContextVariableMap {
    currentUser: UserRow | null;
  }
}

function bearer(c: Context): string | null {
  const header = c.req.header('Authorization') ?? '';
  if (!header.toLowerCase().startsWith('bearer ')) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

/**
 * The role is read from the database on every request rather than trusted
 * from the JWT claim, so a ban or a role change takes effect immediately.
 * That behaviour is carried over from get_current_user() deliberately.
 */
async function loadUser(token: string): Promise<UserRow | null> {
  const payload = await decodeToken(token);
  if (!payload) return null;
  // A refresh token must not be usable as an access token.
  if (payload.type === 'refresh') return null;
  const id = asUuid(payload.sub);
  if (!id) return null;
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

/**
 * Rejects with 401 for a bad token and 403 for a deactivated account.
 * The split matters: lib/api.ts:24 logs the user out on any 401 outside
 * /auth/*, so returning 401 where FastAPI returned 403 would bounce people
 * to the login screen instead of showing them an error.
 */
export const requireAuth: MiddlewareHandler = async (c, next) => {
  const token = bearer(c);
  if (!token) throw unauthorized('Not authenticated');
  const user = await loadUser(token);
  if (!user) throw unauthorized('Could not validate credentials');
  if (!user.is_active) throw forbidden('Inactive user');
  c.set('currentUser', user);
  await next();
};

/** Never throws; leaves currentUser null when there is no usable token. */
export const optionalAuth: MiddlewareHandler = async (c, next) => {
  c.set('currentUser', null);
  const token = bearer(c);
  if (token) {
    const user = await loadUser(token);
    if (user && user.is_active) c.set('currentUser', user);
  }
  await next();
};

export function requireRole(...allowed: Role[]): MiddlewareHandler {
  return async (c, next) => {
    const user = c.get('currentUser');
    if (!user) throw unauthorized('Not authenticated');
    if (!allowed.includes(user.role as Role)) {
      throw forbidden('Not enough permissions');
    }
    await next();
  };
}

export const requireAdminOrModerator = requireRole('admin', 'moderator');
export const requireAdminOnly = requireRole('admin');

/** Use inside a handler that ran behind requireAuth. */
export function currentUser(c: Context): UserRow {
  const user = c.get('currentUser');
  if (!user) throw unauthorized('Not authenticated');
  return user;
}
