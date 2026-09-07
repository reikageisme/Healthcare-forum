import { describe, expect, it, vi } from 'vitest';
import { createAuthService } from './authService';
import { AuthTokenResponse, User } from '../types';

const TOKENS: AuthTokenResponse = {
  access_token: 'access-token',
  refresh_token: 'refresh-token',
  token_type: 'bearer',
};

const USER: User = {
  id: '6ec56c83-30db-4de2-b30f-94f82ac0f87e',
  email: 'lan@example.com',
  username: 'lan',
  role: 'user',
};

function makeClient() {
  const post = vi.fn(async (_url: string, _data?: unknown) => ({ data: TOKENS }));
  const get = vi.fn(async (_url: string, _config?: unknown) => ({ data: USER }));
  const client = { post, get } as unknown as Parameters<typeof createAuthService>[0];
  return { client, post, get, service: createAuthService(client) };
}

describe('authService', () => {
  it('FEAUTH-01 registers exactly once through /auth/register', async () => {
    const { service, post } = makeClient();
    const input = {
      email: 'lan@example.com',
      password: 'password123',
      username: 'lan',
      full_name: 'Lan',
    };

    await expect(service.register(input)).resolves.toEqual(TOKENS);

    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith('/auth/register', input);
    expect(post.mock.calls.some(([url]) => url === '/users/')).toBe(false);
  });

  it('provides typed login, profile and refresh contracts', async () => {
    const { service, post, get } = makeClient();

    await expect(
      service.login({ email: 'lan@example.com', password: 'password123' }),
    ).resolves.toEqual(TOKENS);
    await expect(service.me(TOKENS.access_token)).resolves.toEqual(USER);
    await expect(service.refresh(TOKENS.refresh_token)).resolves.toEqual(TOKENS);

    expect(post).toHaveBeenNthCalledWith(1, '/auth/login', {
      email: 'lan@example.com',
      password: 'password123',
    });
    expect(get).toHaveBeenCalledWith('/auth/me', {
      headers: { Authorization: `Bearer ${TOKENS.access_token}` },
    });
    expect(post).toHaveBeenNthCalledWith(2, '/auth/refresh', {
      refresh_token: TOKENS.refresh_token,
    });
  });

  it('builds a complete session only after the real profile loads', async () => {
    const { service } = makeClient();

    await expect(service.sessionFromTokens(TOKENS)).resolves.toEqual({
      user: USER,
      accessToken: TOKENS.access_token,
      refreshToken: TOKENS.refresh_token,
    });
  });

  it('rejects malformed token responses instead of persisting a partial session', async () => {
    const post = vi.fn(async (_url: string, _data?: unknown) => ({
      data: { access_token: 'access-token', token_type: 'bearer' },
    }));
    const client = { post, get: vi.fn() } as unknown as Parameters<
      typeof createAuthService
    >[0];

    await expect(
      createAuthService(client).login({ email: 'lan@example.com', password: 'password123' }),
    ).rejects.toThrow('Invalid authentication token response');
  });
});
