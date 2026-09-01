import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AuthState } from '../types';

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      // Đăng nhập gọi login hai lần (một lần lấy hồ sơ thật), nên bỏ trống
      // refreshToken ở lần sau phải là "giữ nguyên", không phải "xoá".
      login: (user, token, refreshToken) =>
        set((state) => ({
          user,
          token,
          refreshToken: refreshToken === undefined ? state.refreshToken : refreshToken,
          isAuthenticated: true,
        })),
      setTokens: (token, refreshToken) => set({ token, refreshToken }),
      logout: () => set({ user: null, token: null, refreshToken: null, isAuthenticated: false }),
      setUser: (user) => set({ user }),
    }),
    {
      name: 'auth-storage',
    }
  )
);
