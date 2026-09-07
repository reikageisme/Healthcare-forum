// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import AdminOnlyGuard from './AdminOnlyGuard';
import AdminRouteGuard from './AdminRouteGuard';
import { useAuthStore } from '../../stores/authStore';
import { User, UserRole } from '../../types';

function userWithRole(role: UserRole): User {
  return {
    id: `user-${role}`,
    email: `${role.toLowerCase()}@example.com`,
    username: role.toLowerCase(),
    role,
  };
}

function LocationProbe() {
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '';
  return <div data-testid="location">{`${location.pathname}|${from}`}</div>;
}

function renderAdmin(path = '/admin') {
  return render(
    <MemoryRouter
      initialEntries={[path]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route
          path="/admin/*"
          element={
            <AdminRouteGuard>
              <div>moderation area</div>
            </AdminRouteGuard>
          }
        />
        <Route path="/login" element={<LocationProbe />} />
        <Route path="/" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminRouteGuard', () => {
  beforeEach(() => useAuthStore.getState().clearSession());
  afterEach(cleanup);

  it('FEAUTH-07 sends an anonymous /admin visit to login with its return path', async () => {
    renderAdmin();

    expect((await screen.findByTestId('location')).textContent).toBe('/login|/admin');
    expect(screen.queryByText('moderation area')).toBeNull();
  });

  it('FEAUTH-08 denies a regular user but permits moderators and admins', () => {
    useAuthStore.getState().setSession({
      user: userWithRole('user'),
      accessToken: 'access-user',
      refreshToken: 'refresh-user',
    });
    const regular = renderAdmin();
    expect(screen.getByTestId('location').textContent).toBe('/|/admin');
    regular.unmount();

    for (const role of ['moderator', 'admin'] as const) {
      useAuthStore.getState().setSession({
        user: userWithRole(role),
        accessToken: `access-${role}`,
        refreshToken: `refresh-${role}`,
      });
      const allowed = renderAdmin();
      expect(screen.getByText('moderation area')).not.toBeNull();
      allowed.unmount();
    }
  });

  it('keeps admin-only routes unavailable to moderators', () => {
    useAuthStore.getState().setSession({
      user: userWithRole('moderator'),
      accessToken: 'access-moderator',
      refreshToken: 'refresh-moderator',
    });

    render(
      <MemoryRouter
        initialEntries={['/admin/users']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route
            path="/admin/users"
            element={
              <AdminRouteGuard>
                <AdminOnlyGuard>
                  <div>admin-only area</div>
                </AdminOnlyGuard>
              </AdminRouteGuard>
            }
          />
          <Route path="/admin/dashboard" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('location').textContent).toBe('/admin/dashboard|');
    expect(screen.queryByText('admin-only area')).toBeNull();
  });

  it('keeps admin-only routes available to admins', () => {
    useAuthStore.getState().setSession({
      user: userWithRole('admin'),
      accessToken: 'access-admin',
      refreshToken: 'refresh-admin',
    });

    render(
      <MemoryRouter
        initialEntries={['/admin/users']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route
            path="/admin/users"
            element={
              <AdminRouteGuard>
                <AdminOnlyGuard>
                  <div>admin-only area</div>
                </AdminOnlyGuard>
              </AdminRouteGuard>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('admin-only area')).not.toBeNull();
  });
});
