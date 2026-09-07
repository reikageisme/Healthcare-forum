// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import AuthenticatedRouteGuard from './AuthenticatedRouteGuard';
import { useAuthStore } from '../../stores/authStore';

function LoginProbe() {
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '';
  return <div data-testid="login-location">{`${location.pathname}|${from}`}</div>;
}

describe('AuthenticatedRouteGuard', () => {
  beforeEach(() => useAuthStore.getState().clearSession());
  afterEach(cleanup);

  it('FEAUTH-09 redirects before an anonymous edit page can mount or load data', async () => {
    const onEditMount = vi.fn();
    const EditPage = () => {
      onEditMount();
      return <div>edit page</div>;
    };

    render(
      <MemoryRouter
        initialEntries={['/posts/post-1/edit']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route
            path="/posts/:id/edit"
            element={
              <AuthenticatedRouteGuard>
                <EditPage />
              </AuthenticatedRouteGuard>
            }
          />
          <Route path="/login" element={<LoginProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect((await screen.findByTestId('login-location')).textContent).toBe(
      '/login|/posts/post-1/edit',
    );
    expect(onEditMount).not.toHaveBeenCalled();
  });

  it('renders the edit page for a complete authenticated session', () => {
    useAuthStore.getState().setSession({
      user: {
        id: 'user-1',
        email: 'lan@example.com',
        username: 'lan',
        role: 'user',
      },
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
    });

    render(
      <MemoryRouter
        initialEntries={['/posts/post-1/edit']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route
            path="/posts/:id/edit"
            element={
              <AuthenticatedRouteGuard>
                <div>edit page</div>
              </AuthenticatedRouteGuard>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('edit page')).not.toBeNull();
  });
});
