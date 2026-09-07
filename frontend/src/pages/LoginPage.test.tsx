// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { authService } from '../services/authService';
import { useAuthStore } from '../stores/authStore';
import { AuthSession, AuthTokenResponse } from '../types';
import LoginPage, { resolveLoginReturnPath } from './LoginPage';

vi.mock('../services/authService', () => ({
  authService: {
    login: vi.fn(),
    register: vi.fn(),
    sessionFromTokens: vi.fn(),
  },
}));

const TOKENS: AuthTokenResponse = {
  access_token: 'access-1',
  refresh_token: 'refresh-1',
  token_type: 'bearer',
};

const SESSION: AuthSession = {
  user: {
    id: '6ec56c83-30db-4de2-b30f-94f82ac0f87e',
    email: 'lan@example.com',
    username: 'lan',
    role: 'user',
  },
  accessToken: TOKENS.access_token,
  refreshToken: TOKENS.refresh_token,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().clearSession();
  });
  afterEach(cleanup);

  it('FEAUTH-01 registers through authService and persists no fake intermediate user', async () => {
    const sessionResult = deferred<AuthSession>();
    vi.mocked(authService.register).mockResolvedValue(TOKENS);
    vi.mocked(authService.sessionFromTokens).mockReturnValue(sessionResult.promise);

    render(
      <MemoryRouter
        initialEntries={['/login?from=%2Fposts%2Fpost-1%2Fedit']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/posts/:id/edit" element={<div>returned to edit</div>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Đăng ký ngay' }));
    fireEvent.change(screen.getByPlaceholderText('Nguyễn Văn A'), { target: { value: 'Lan' } });
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'lan@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng ký' }));

    await waitFor(() => expect(authService.register).toHaveBeenCalledTimes(1));
    expect(authService.register).toHaveBeenCalledWith({
      email: 'lan@example.com',
      password: 'password123',
      username: 'lan',
      full_name: 'Lan',
    });
    expect(authService.login).not.toHaveBeenCalled();
    expect(authService.sessionFromTokens).toHaveBeenCalledWith(TOKENS);
    expect(useAuthStore.getState()).toMatchObject({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
    });

    await act(async () => sessionResult.resolve(SESSION));

    expect(await screen.findByText('returned to edit')).not.toBeNull();
    expect(useAuthStore.getState()).toMatchObject({
      user: SESSION.user,
      token: TOKENS.access_token,
      refreshToken: TOKENS.refresh_token,
      isAuthenticated: true,
    });
  });

  it('accepts only same-origin return paths from query or router state', () => {
    expect(resolveLoginReturnPath('?from=%2Fadmin%3Ftab%3Dreports', null)).toBe(
      '/admin?tab=reports',
    );
    expect(
      resolveLoginReturnPath('', {
        from: { pathname: '/posts/post-1/edit', search: '?tab=content', hash: '#editor' },
      }),
    ).toBe('/posts/post-1/edit?tab=content#editor');
    expect(resolveLoginReturnPath('?from=https%3A%2F%2Fattacker.test', null)).toBeNull();
    expect(resolveLoginReturnPath('?from=%2F%2Fattacker.test', null)).toBeNull();
    expect(resolveLoginReturnPath('?from=%2F%5Cattacker.test', null)).toBeNull();
  });
});
