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
      /**
       * Refresh token cố ý KHÔNG được lưu xuống localStorage nữa.
       *
       * Nó sống trong cookie HttpOnly đặt ở tên miền cha, nên hai việc cùng
       * đạt được: forum.medicvn.com nhận ra phiên đăng nhập mở từ
       * medicvn.com (localStorage thì không, vì gắn chặt một origin), và một
       * lỗ XSS cũng không đọc được tấm vé sống 7 ngày ấy.
       *
       * Vẫn giữ user + access token để mở lại tab là thấy giao diện đã đăng
       * nhập ngay, không phải chờ một vòng gọi mạng.
       */
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
