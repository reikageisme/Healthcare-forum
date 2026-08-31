import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { sql } from 'drizzle-orm';
import { setDatabase, schema } from '../src/db/index.js';
import { db } from '../src/db/index.js';
import { ensureSchema } from '../src/scripts/migrate.js';
import { createApp } from '../src/app.js';
import { hashPassword, createAccessToken } from '../src/core/security.js';
import { users } from '../src/db/schema.js';

let client: PGlite | null = null;

export async function freshDatabase() {
  client = new PGlite();
  const testDb = drizzle(client, { schema });
  setDatabase(testDb as never);

  // Same bootstrap path production uses, so the DDL is exercised by tests
  // rather than being a file nothing ever runs.
  await ensureSchema();
  return testDb;
}

export async function closeDatabase() {
  await client?.close();
  client = null;
}

export const app = createApp();

export interface SeededUser {
  id: string;
  email: string;
  username: string;
  role: 'user' | 'doctor' | 'moderator' | 'admin';
  password: string;
  token: string;
}

export async function seedUser(
  role: SeededUser['role'],
  overrides: Partial<{ email: string; username: string; password: string }> = {},
): Promise<SeededUser> {
  const password = overrides.password ?? 'CorrectHorse123!';
  const email = overrides.email ?? `${role}-${Date.now()}-${Math.random()}@test.vn`;
  const username = overrides.username ?? `${role}_${Math.random().toString(36).slice(2, 8)}`;

  const inserted = await db
    .insert(users)
    .values({
      email,
      username,
      hashed_password: await hashPassword(password),
      role,
      is_active: true,
    })
    .returning();
  const user = inserted[0]!;
  return {
    id: user.id,
    email,
    username,
    role,
    password,
    token: await createAccessToken(user.id, role),
  };
}

/** Calls the app in-process; no server, no port. */
export function request(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.token) headers.set('Authorization', `Bearer ${init.token}`);
  // Only JSON bodies get a content type here; FormData must keep the
  // multipart boundary fetch generates for it.
  if (typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return app.request(`http://localhost/api/v1${path}`, { ...init, headers });
}

export const json = (body: unknown) => JSON.stringify(body);
