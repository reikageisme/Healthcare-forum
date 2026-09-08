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
      /**
       * Refresh token cố ý KHÔNG được lưu xuống localStorage nữa.
       *
       * Nó sống trong cookie HttpOnly đặt ở tên miền cha, nên hai việc cùng
       * đạt được: forums.medicvn.com nhận ra phiên đăng nhập mở từ
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
