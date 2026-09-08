import { useEffect } from 'react';
import axios from 'axios';
import api from '../lib/api';
import { useAuthStore } from '../stores/authStore';

/**
 * Nhận lại phiên đăng nhập từ cookie khi vừa mở trang.
 *
 * Người dùng đăng nhập ở medicvn.com rồi bấm sang forums.medicvn.com: tên miền
 * con không có gì trong localStorage của nó, nhưng cookie refresh token đặt ở
 * tên miền cha thì vẫn đi kèm. Một lần gọi /auth/refresh là đủ để đổi lấy
 * access token mới và hồ sơ người dùng — họ không phải nhập lại mật khẩu.
 *
 * Thất bại là chuyện bình thường: khách chưa đăng nhập vẫn đọc được diễn đàn,
 * nên lỗi ở đây chỉ có nghĩa "chưa đăng nhập", không phải sự cố.
 *
 * Dù kết thúc thế nào cũng phải bật authReady. Trước đây không có cờ này:
 * trong vài trăm mili giây chờ /auth/refresh, mọi trang chặn quyền đọc được
 * isAuthenticated === false rồi đá người dùng sang /login — người đang đăng
 * nhập đàng hoàng vẫn bị đá, và bấm Back thì bị đá lại lần nữa.
 */
let attempted = false;

export function useSilentLogin() {
  useEffect(() => {
    // Một lần cho mỗi lần tải trang. StrictMode gọi effect hai lần ở dev, và
    // hai app đều gắn hook này, nên cờ nằm ngoài component.
    if (attempted) return;
    attempted = true;

    const { token, user, markAuthReady } = useAuthStore.getState();
    if (token && user) {
      markAuthReady();
      return;
    }

    void (async () => {
      try {
        // axios trần: request này không được đi qua interceptor 401 của `api`,
        // nếu không một lần chưa đăng nhập sẽ tự đá người xem về /login.
        const res = await axios.post('/api/v1/auth/refresh', {}, { withCredentials: true });
        const accessToken: string | undefined = res.data?.access_token;
        if (!accessToken) return;

        useAuthStore.getState().setTokens(accessToken, null);
        const me = await api.get('/auth/me');
        useAuthStore.getState().login(me.data, accessToken, null);
      } catch {
        // Chưa đăng nhập, hoặc cookie đã hết hạn.
      } finally {
        useAuthStore.getState().markAuthReady();
      }
    })();
  }, []);
}

export default useSilentLogin;
