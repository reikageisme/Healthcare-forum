// @vitest-environment jsdom

import {
  AxiosAdapter,
  AxiosError,
  AxiosHeaders,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AuthApiDependencies,
  createApiClient,
  isRefreshExcludedRequest,
  loginRedirectUrl,
} from './api';
import { AuthTokenResponse, AuthTokens, User } from '../types';

const USER: User = {
  id: '6ec56c83-30db-4de2-b30f-94f82ac0f87e',
  email: 'lan@example.com',
  username: 'lan',
  role: 'user',
};

const NEW_TOKENS: AuthTokenResponse = {
  access_token: 'access-2',
  refresh_token: 'refresh-2',
  token_type: 'bearer',
};

function success<T>(config: InternalAxiosRequestConfig, data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: new AxiosHeaders(),
    config,
  };
}

function unauthorized(config: InternalAxiosRequestConfig): never {
  const response: AxiosResponse = {
    data: { detail: 'Unauthorized' },
    status: 401,
    statusText: 'Unauthorized',
    headers: new AxiosHeaders(),
    config,
  };
  throw new AxiosError('Request failed with status code 401', 'ERR_BAD_REQUEST', config, null, response);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function makeHarness() {
  let session = {
    user: USER as User | null,
    token: 'access-1' as string | null,
    refreshToken: 'refresh-1' as string | null,
    isAuthenticated: true,
  };

  const refresh = vi.fn(async (_refreshToken: string) => NEW_TOKENS);
  const rotateTokens = vi.fn((tokens: AuthTokens) => {
    session = {
      ...session,
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      isAuthenticated: true,
    };
  });
  const clearSession = vi.fn(() => {
    session = { user: null, token: null, refreshToken: null, isAuthenticated: false };
  });
  const redirectToLogin = vi.fn();
  const dependencies: AuthApiDependencies = {
    getSession: () => session,
    refresh,
    rotateTokens,
    clearSession,
    redirectToLogin,
  };
  const client = createApiClient(dependencies);

  return {
    client,
    refresh,
    rotateTokens,
    clearSession,
    redirectToLogin,
    getSession: () => session,
  };
}

describe('authenticated API client', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('FEAUTH-03 refreshes once and replays the protected request once', async () => {
    const harness = makeHarness();
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      if (config.headers.get('Authorization') === 'Bearer access-2') {
        return success(config, { ok: true });
      }
      return unauthorized(config);
    });
    harness.client.defaults.adapter = adapter as AxiosAdapter;

    await expect(harness.client.get('/posts/private')).resolves.toMatchObject({
      data: { ok: true },
    });

    expect(harness.refresh).toHaveBeenCalledOnce();
    expect(harness.refresh).toHaveBeenCalledWith('refresh-1');
    expect(harness.rotateTokens).toHaveBeenCalledWith({
      accessToken: 'access-2',
      refreshToken: 'refresh-2',
    });
    expect(adapter).toHaveBeenCalledTimes(2);
  });

  it('FEAUTH-04 shares one refresh across three concurrent 401 responses', async () => {
    const harness = makeHarness();
    const refreshResult = deferred<AuthTokenResponse>();
    harness.refresh.mockReturnValue(refreshResult.promise);
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      if (config.headers.get('Authorization') === 'Bearer access-2') {
        return success(config, { url: config.url });
      }
      return unauthorized(config);
    });
    harness.client.defaults.adapter = adapter as AxiosAdapter;

    const requests = ['/one', '/two', '/three'].map((url) => harness.client.get(url));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(harness.refresh).toHaveBeenCalledTimes(1);
    refreshResult.resolve(NEW_TOKENS);
    const responses = await Promise.all(requests);

    expect(responses.map((response) => response.data)).toEqual([
      { url: '/one' },
      { url: '/two' },
      { url: '/three' },
    ]);
    expect(adapter).toHaveBeenCalledTimes(6);
  });

  it('FEAUTH-05 clears and redirects once when the shared refresh fails', async () => {
    window.history.replaceState({}, '', '/posts/post-1/edit?tab=content#editor');
    const harness = makeHarness();
    const refreshResult = deferred<AuthTokenResponse>();
    harness.refresh.mockReturnValue(refreshResult.promise);
    harness.client.defaults.adapter = (async (config: InternalAxiosRequestConfig) =>
      unauthorized(config)) as AxiosAdapter;

    const requests = ['/one', '/two', '/three'].map((url) => harness.client.get(url));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(harness.refresh).toHaveBeenCalledTimes(1);
    refreshResult.reject(new Error('refresh expired'));

    const results = await Promise.allSettled(requests);
    expect(results.every((result) => result.status === 'rejected')).toBe(true);
    expect(harness.clearSession).toHaveBeenCalledTimes(1);
    expect(harness.redirectToLogin).toHaveBeenCalledTimes(1);
    expect(harness.redirectToLogin).toHaveBeenCalledWith(
      '/posts/post-1/edit?tab=content#editor',
    );
    expect(harness.getSession()).toEqual({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
    });
  });

  it('FEAUTH-06 never refreshes login, registration or refresh endpoint failures', async () => {
    const harness = makeHarness();
    harness.client.defaults.adapter = (async (config: InternalAxiosRequestConfig) =>
      unauthorized(config)) as AxiosAdapter;

    const results = await Promise.allSettled([
      harness.client.post('/auth/login'),
      harness.client.post('/auth/register'),
      harness.client.post('/api/v1/auth/refresh'),
    ]);

    expect(results.every((result) => result.status === 'rejected')).toBe(true);
    expect(harness.refresh).not.toHaveBeenCalled();
    expect(harness.clearSession).not.toHaveBeenCalled();
    expect(harness.redirectToLogin).not.toHaveBeenCalled();
  });

  it('marks a replay so a second 401 cannot create a refresh loop', async () => {
    const harness = makeHarness();
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => unauthorized(config));
    harness.client.defaults.adapter = adapter as AxiosAdapter;

    await expect(harness.client.get('/still-unauthorized')).rejects.toBeInstanceOf(AxiosError);

    expect(harness.refresh).toHaveBeenCalledTimes(1);
    expect(adapter).toHaveBeenCalledTimes(2);
    expect(harness.clearSession).toHaveBeenCalledTimes(1);
    expect(harness.redirectToLogin).toHaveBeenCalledTimes(1);
  });

  it('normalises auth exclusions and a same-origin login return URL', () => {
    expect(isRefreshExcludedRequest('/auth/login?next=/admin')).toBe(true);
    expect(isRefreshExcludedRequest('https://example.test/api/v1/auth/register')).toBe(true);
    expect(isRefreshExcludedRequest('/api/v1/auth/refresh/')).toBe(true);
    expect(isRefreshExcludedRequest('/auth/me')).toBe(false);
    expect(loginRedirectUrl('/posts/post-1/edit?tab=content')).toBe(
      '/login?from=%2Fposts%2Fpost-1%2Fedit%3Ftab%3Dcontent',
    );
    expect(loginRedirectUrl('https://attacker.test/')).toBe('/login?from=%2F');
    expect(loginRedirectUrl('/\\attacker.test')).toBe('/login?from=%2F');
  });
});
