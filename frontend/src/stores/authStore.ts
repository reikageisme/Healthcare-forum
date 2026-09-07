import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AuthState, User } from '../types';

export const AUTH_STORAGE_KEY = 'auth-storage';
export const AUTH_STORAGE_VERSION = 1;

interface PersistedAuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
}

const EMPTY_SESSION: PersistedAuthState = {
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPersistedUser(value: unknown): value is User {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.email === 'string' &&
    typeof value.username === 'string' &&
    typeof value.role === 'string'
  );
}

/**
 * Normalise both the original access-token-only state and the current shape.
 * An interrupted legacy login could have persisted the old fake, empty user;
 * that state is intentionally discarded instead of being revived as a session.
 */
export function migratePersistedAuth(value: unknown): PersistedAuthState {
  if (!isRecord(value)) return { ...EMPTY_SESSION };

  const user = isPersistedUser(value.user) ? value.user : null;
  const token = typeof value.token === 'string' && value.token ? value.token : null;
  const refreshToken =
    typeof value.refreshToken === 'string' && value.refreshToken ? value.refreshToken : null;

  if (!user || !token) return { ...EMPTY_SESSION };
  return { user, token, refreshToken, isAuthenticated: true };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      ...EMPTY_SESSION,
      setSession: ({ user, accessToken, refreshToken }) =>
        set({ user, token: accessToken, refreshToken, isAuthenticated: true }),
      rotateTokens: ({ accessToken, refreshToken }) =>
        set((state) =>
          state.user && state.token
            ? { token: accessToken, refreshToken, isAuthenticated: true }
            : EMPTY_SESSION,
        ),
      clearSession: () => set(EMPTY_SESSION),
      logout: () => set(EMPTY_SESSION),
      setUser: (user) => set({ user }),
    }),
    {
      name: AUTH_STORAGE_KEY,
      version: AUTH_STORAGE_VERSION,
      partialize: ({ user, token, refreshToken, isAuthenticated }) => ({
        user,
        token,
        refreshToken,
        isAuthenticated,
      }),
      migrate: (persistedState) => migratePersistedAuth(persistedState),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...migratePersistedAuth(persistedState),
      }),
    },
  ),
);
