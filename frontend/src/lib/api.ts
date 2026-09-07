import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { authService } from '../services/authService';
import { useAuthStore } from '../stores/authStore';
import { AuthTokenResponse, AuthTokens, User } from '../types';

interface SessionSnapshot {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
}

export interface AuthApiDependencies {
  getSession: () => SessionSnapshot;
  refresh: (refreshToken: string) => Promise<AuthTokenResponse>;
  rotateTokens: (tokens: AuthTokens) => void;
  clearSession: () => void;
  redirectToLogin: (returnPath: string) => void;
}

type RetriableConfig = InternalAxiosRequestConfig & { _authRetried?: boolean };

class SessionChangedDuringRefreshError extends Error {}

export function isRefreshExcludedRequest(url?: string): boolean {
  if (!url) return false;
  const pathname = new URL(url, 'http://local.invalid').pathname.replace(/\/+$/, '');
  return /(?:^|\/)auth\/(?:login|register|refresh)$/.test(pathname);
}

function hasUnsafeControlCharacters(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code < 0x20 || code === 0x7f;
  });
}

export function currentReturnPath(): string {
  if (typeof window === 'undefined') return '/';
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export function loginRedirectUrl(returnPath: string): string {
  const safePath =
    returnPath.startsWith('/') &&
    !returnPath.startsWith('//') &&
    !returnPath.includes('\\') &&
    !hasUnsafeControlCharacters(returnPath)
      ? returnPath
      : '/';
  if (safePath === '/login' || safePath.startsWith('/login?')) return '/login';
  return `/login?from=${encodeURIComponent(safePath)}`;
}

const defaultDependencies: AuthApiDependencies = {
  getSession: () => useAuthStore.getState(),
  refresh: (refreshToken) => authService.refresh(refreshToken),
  rotateTokens: (tokens) => useAuthStore.getState().rotateTokens(tokens),
  clearSession: () => useAuthStore.getState().clearSession(),
  redirectToLogin: (returnPath) => {
    if (typeof window !== 'undefined') window.location.assign(loginRedirectUrl(returnPath));
  },
};

export function createApiClient(dependencies: AuthApiDependencies = defaultDependencies): AxiosInstance {
  const client = axios.create({
    baseURL: '/api/v1',
    headers: { 'Content-Type': 'application/json' },
  });
  let pendingRefresh: Promise<string> | null = null;

  const failSession = () => {
    const session = dependencies.getSession();
    const hadSession = Boolean(
      session.user || session.token || session.refreshToken || session.isAuthenticated,
    );
    if (!hadSession) return;
    dependencies.clearSession();
    dependencies.redirectToLogin(currentReturnPath());
  };

  const refreshAccessToken = async (refreshToken: string): Promise<string> => {
    const response = await dependencies.refresh(refreshToken);
    if (dependencies.getSession().refreshToken !== refreshToken) {
      throw new SessionChangedDuringRefreshError();
    }
    dependencies.rotateTokens({
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
    });
    if (dependencies.getSession().token !== response.access_token) {
      throw new SessionChangedDuringRefreshError();
    }
    return response.access_token;
  };

  const getRefresh = (refreshToken: string) => {
    if (!pendingRefresh) {
      pendingRefresh = refreshAccessToken(refreshToken)
        .catch((error: unknown) => {
          if (!(error instanceof SessionChangedDuringRefreshError)) failSession();
          throw error;
        })
        .finally(() => {
          pendingRefresh = null;
        });
    }
    return pendingRefresh;
  };

  client.interceptors.request.use((config) => {
    const token = dependencies.getSession().token;
    if (token && !config.headers.get('Authorization')) {
      config.headers.set('Authorization', `Bearer ${token}`);
    }
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const config = error.config as RetriableConfig | undefined;
      if (!config || error.response?.status !== 401 || isRefreshExcludedRequest(config.url)) {
        return Promise.reject(error);
      }

      if (config._authRetried) {
        failSession();
        return Promise.reject(error);
      }

      const { refreshToken, token, user, isAuthenticated } = dependencies.getSession();
      if (!refreshToken) {
        if (token || user || isAuthenticated) failSession();
        return Promise.reject(error);
      }

      config._authRetried = true;
      try {
        const accessToken = await getRefresh(refreshToken);
        config.headers.set('Authorization', `Bearer ${accessToken}`);
        return client.request(config);
      } catch {
        return Promise.reject(error);
      }
    },
  );

  return client;
}

const api = createApiClient();

export default api;
