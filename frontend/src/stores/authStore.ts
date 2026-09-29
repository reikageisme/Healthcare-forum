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
      // Chỉ bật sau khi useSilentLogin chạy xong (thành công hay không).
      // Không nằm trong partialize: mỗi lần tải trang phải hỏi lại từ đầu.
      authReady: false,
      // Đăng nhập gọi login hai lần (một lần lấy hồ sơ thật), nên bỏ trống
      // refreshToken ở lần sau phải là "giữ nguyên", không phải "xoá".
      login: (user, token, refreshToken) =>
        set((state) => ({
          user,
          token,
          refreshToken: refreshToken === undefined ? state.refreshToken : refreshToken,
          isAuthenticated: true,
          authReady: true,
        })),
      setTokens: (token, refreshToken) => set({ token, refreshToken }),
      logout: () =>
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          authReady: true,
        }),
      setUser: (user) => set({ user }),
      markAuthReady: () => set({ authReady: true }),
    }),
    {
      name: 'auth-storage',
      version: 2,
      /** Credentials stay in memory; the HttpOnly parent-domain cookie is the
       * only persisted session. This prevents a sibling domain from looking
       * logged in with a stale JWT after logout elsewhere. */
      partialize: (state) => ({
        user: state.user,
      }),
      migrate: (persisted) => {
        const state = (persisted ?? {}) as Partial<AuthState>;
        return { user: state.user ?? null };
      },
    }
  )
);
