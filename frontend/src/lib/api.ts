import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { useAuthStore } from '../stores/authStore';

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Access token sống 30 phút, refresh token sống 7 ngày. Trước đây client
 * không hề dùng refresh token: viết bài quá nửa tiếng rồi chèn ảnh là ăn
 * 401 "Could not validate credentials", bị đá về trang đăng nhập và mất
 * nguyên bài đang soạn.
 *
 * Một 401 đầu tiên giờ đổi lấy token mới rồi phát lại đúng request đó. Chỉ
 * thử một lần cho mỗi request (_retried), và nhiều request 401 cùng lúc dùng
 * chung một lần gọi refresh (pendingRefresh) thay vì mỗi cái gọi một lần.
 */
type RetriableConfig = AxiosRequestConfig & { _retried?: boolean };

let pendingRefresh: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken } = useAuthStore.getState();
  if (!refreshToken) return null;

  // Gọi bằng axios trần: đi qua `api` thì 401 của chính /auth/refresh lại
  // rơi vào interceptor này.
  const res = await axios.post('/api/v1/auth/refresh', { refresh_token: refreshToken });
  const token: string | undefined = res.data?.access_token;
  if (!token) return null;

  useAuthStore.getState().setTokens(token, res.data?.refresh_token ?? refreshToken);
  return token;
}

function forceLogout() {
  useAuthStore.getState().logout();
  window.location.href = '/login';
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = (error.config ?? {}) as RetriableConfig;
    const url: string = config.url || '';

    if (error.response?.status !== 401 || url.startsWith('/auth/')) {
      return Promise.reject(error);
    }

    if (config._retried || !useAuthStore.getState().refreshToken) {
      forceLogout();
      return Promise.reject(error);
    }

    config._retried = true;
    try {
      pendingRefresh = pendingRefresh ?? refreshAccessToken().finally(() => {
        pendingRefresh = null;
      });
      const token = await pendingRefresh;
      if (!token) {
        forceLogout();
        return Promise.reject(error);
      }
      config.headers = { ...config.headers, Authorization: `Bearer ${token}` };
      return api.request(config);
    } catch {
      // Refresh token hết hạn hoặc tài khoản bị khoá: hết đường, đăng nhập lại.
      forceLogout();
      return Promise.reject(error);
    }
  },
);

export default api;
