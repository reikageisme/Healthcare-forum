import { describe, expect, it } from 'vitest';
import { parseDatabaseTarget } from '../src/scripts/createDatabase.js';

/**
 * The first boot against a fresh Postgres depends entirely on this parsing:
 * every other script connects straight to the application database, which
 * does not exist yet, so the connection is refused before any SQL runs.
 */
describe('database bootstrap target', () => {
  it('points at the maintenance database while keeping host and credentials', () => {
    const target = parseDatabaseTarget(
      'postgresql://postgres:secret@192.168.1.102:5432/healthcare_forum',
    );
    expect(target.dbName).toBe('healthcare_forum');
    expect(target.host).toBe('192.168.1.102:5432');
    expect(target.username).toBe('postgres');
    expect(target.adminUrl).toBe('postgresql://postgres:secret@192.168.1.102:5432/postgres');
  });

  it('keeps a password containing URL-unsafe characters intact', () => {
    const target = parseDatabaseTarget(
      'postgresql://app:p%40ss%3Aword@db.internal:5433/healthcare_forum',
    );
    expect(target.username).toBe('app');
    expect(target.adminUrl).toContain('p%40ss%3Aword');
    expect(target.adminUrl.endsWith('/postgres')).toBe(true);
  });

  it('refuses a database name that could break out of the CREATE statement', () => {
    expect(() =>
      parseDatabaseTarget('postgresql://postgres:x@localhost:5432/evil";DROP DATABASE x;--'),
    ).toThrow(/Refusing to create/);
  });

  it('refuses a URL with no database name', () => {
    expect(() => parseDatabaseTarget('postgresql://postgres:x@localhost:5432/')).toThrow(
      /no database name/,
    );
  });
});
