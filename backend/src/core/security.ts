import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { settings } from './config.js';

const secretKey = new TextEncoder().encode(settings.JWT_SECRET);

export type TokenKind = 'access' | 'refresh';

export interface TokenPayload {
  sub: string;
  role: string;
  /**
   * Added during the migration. The Python implementation issued access and
   * refresh tokens with byte-identical payloads, so a leaked 30-minute access
   * token could be exchanged at /auth/refresh for a 7-day refresh token and
   * kept alive forever. Refresh now requires this claim.
   */
  type?: TokenKind;
  exp: number;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/**
 * Verifies against the bcrypt hashes written by the Python stack. The stored
 * `$2b$` digests must keep working, so the algorithm cannot be swapped.
 */
export async function verifyPassword(plain: string, hashed: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hashed);
  } catch {
    return false;
  }
}

async function sign(sub: string, role: string, type: TokenKind, expiresIn: string) {
  return new SignJWT({ role, type })
    .setProtectedHeader({ alg: settings.JWT_ALGORITHM })
    .setSubject(String(sub))
    .setExpirationTime(expiresIn)
    .sign(secretKey);
}

export function createAccessToken(sub: string, role: string) {
  return sign(sub, role, 'access', `${settings.ACCESS_TOKEN_EXPIRE_MINUTES}m`);
}

export function createRefreshToken(sub: string, role: string) {
  return sign(sub, role, 'refresh', `${settings.REFRESH_TOKEN_EXPIRE_DAYS}d`);
}

/** Returns null on any failure, matching decode_token()'s contract. */
export async function decodeToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: [settings.JWT_ALGORITHM],
    });
    if (!payload.sub) return null;
    return {
      sub: String(payload.sub),
      role: String(payload.role ?? ''),
      type: payload.type as TokenKind | undefined,
      exp: Number(payload.exp ?? 0),
    };
  } catch {
    return null;
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * JWT subjects come back as strings; uuid columns need a real UUID.
 * Postgres raises on a malformed uuid literal, so every id that reaches a
 * query goes through here first (auth.py:54 skipped this and crashed).
 */
export function asUuid(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return UUID_RE.test(value) ? value : null;
}
