// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import {
  AUTH_STORAGE_KEY,
  AUTH_STORAGE_VERSION,
  migratePersistedAuth,
  useAuthStore,
} from './authStore';
import { User } from '../types';

const USER: User = {
  id: '6ec56c83-30db-4de2-b30f-94f82ac0f87e',
  email: 'lan@example.com',
  username: 'lan',
  role: 'user',
};

describe('authStore session lifecycle', () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession();
    localStorage.clear();
  });

  it('FEAUTH-02 persists user and both tokens in one session transition', () => {
    useAuthStore.getState().setSession({
      user: USER,
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
    });

    expect(useAuthStore.getState()).toMatchObject({
      user: USER,
      token: 'access-1',
      refreshToken: 'refresh-1',
      isAuthenticated: true,
    });

    const persisted = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) ?? '{}');
    expect(persisted.version).toBe(AUTH_STORAGE_VERSION);
    expect(persisted.state).toEqual({
      user: USER,
      token: 'access-1',
      refreshToken: 'refresh-1',
      isAuthenticated: true,
    });
  });

  it('rotates both tokens together and preserves the profile', () => {
    useAuthStore.getState().setSession({
      user: USER,
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
    });

    useAuthStore.getState().rotateTokens({
      accessToken: 'access-2',
      refreshToken: 'refresh-2',
    });

    expect(useAuthStore.getState()).toMatchObject({
      user: USER,
      token: 'access-2',
      refreshToken: 'refresh-2',
      isAuthenticated: true,
    });
  });

  it('clears the entire session on logout', () => {
    useAuthStore.getState().setSession({
      user: USER,
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
    });

    useAuthStore.getState().logout();

    expect(useAuthStore.getState()).toMatchObject({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
    });
  });

  it('migrates the legacy access-token-only state without inventing a refresh token', () => {
    expect(
      migratePersistedAuth({ user: USER, token: 'legacy-access', isAuthenticated: true }),
    ).toEqual({
      user: USER,
      token: 'legacy-access',
      refreshToken: null,
      isAuthenticated: true,
    });
  });

  it('discards an interrupted legacy login with a fake empty user', () => {
    expect(
      migratePersistedAuth({
        user: { ...USER, id: '' },
        token: 'legacy-access',
        refreshToken: 'legacy-refresh',
        isAuthenticated: true,
      }),
    ).toEqual({ user: null, token: null, refreshToken: null, isAuthenticated: false });
  });
});
