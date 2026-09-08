import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import api from '../lib/api';
import { Loader2, HeartPulse, User, Lock, Mail, ArrowRight, ArrowLeft } from 'lucide-react';
import { describeApiError } from '../lib/apiError';
import { safeNext } from '../lib/siteLinks';

/** Lỗi Google trả về qua ?error=, đổi sang tiếng người đọc được. */
const OAUTH_ERRORS: Record<string, string> = {
  google_cancelled: 'Bạn đã hủy đăng nhập bằng Google.',
  google_state: 'Phiên đăng nhập Google đã hết hạn. Vui lòng thử lại.',
  google_token: 'Google không xác nhận được tài khoản. Vui lòng thử lại.',
  google_link:
    'Email này đã có tài khoản dùng mật khẩu. Hãy đăng nhập bằng mật khẩu, hoặc dùng một tài khoản Google đã xác minh email.',
  google_disabled: 'Đăng nhập bằng Google chưa được bật trên máy chủ.',
  google_failed: 'Đăng nhập bằng Google thất bại. Vui lòng thử lại.',
  account_disabled: 'Tài khoản này đã bị khóa.',
};

export const LoginPage: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasGoogle, setHasGoogle] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((state) => state.login);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const authReady = useAuthStore((state) => state.authReady);

  const params = new URLSearchParams(location.search);

  /**
   * Nơi quay về sau khi đăng nhập.
   *
   * Diễn đàn không có trang đăng nhập của riêng nó — bấm "Trả lời" ở
   * forums.medicvn.com sẽ sang đây kèm ?next=<thớt đang đọc>. safeNext chỉ
   * chấp nhận địa chỉ thuộc hai tên miền của mình; không có nó thì
   * ?next=https://trang-lua-dao biến trang này thành một open redirect.
   */
  const nextUrl = safeNext(params.get('next'));

  useEffect(() => {
    const reason = params.get('error');
    if (reason) setError(OAUTH_ERRORS[reason] ?? 'Đăng nhập thất bại. Vui lòng thử lại.');
    // Chỉ đọc một lần lúc mở trang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Đã đăng nhập rồi thì không có việc gì ở đây.
   *
   * `replace` chứ không `push`: nếu để trang này nằm lại trong lịch sử, bấm
   * Back sẽ quay về đúng nó rồi bị đẩy đi tiếp — nút lùi coi như hỏng, đúng
   * cái lỗi phải sửa địa chỉ trên thanh URL mới thoát ra được.
   */
  useEffect(() => {
    if (!authReady || !isAuthenticated) return;
    if (nextUrl) window.location.replace(nextUrl);
    else navigate('/', { replace: true });
  }, [authReady, isAuthenticated, nextUrl, navigate]);

  // Nút Google chỉ hiện khi máy chủ thật sự có cấu hình cho nó.
  useEffect(() => {
    void api
      .get('/auth/providers')
      .then((res) => setHasGoogle(Boolean(res.data?.google)))
      .catch(() => setHasGoogle(false));
  }, []);

  const googleHref = `/api/v1/auth/google${
    nextUrl ? `?next=${encodeURIComponent(nextUrl)}` : ''
  }`;

  /** Rời tên miền thì phải dùng window.location, react-router không làm được. */
  const goAfterAuth = (fallback: string) => {
    if (nextUrl) {
      window.location.replace(nextUrl);
      return;
    }
    navigate(fallback, { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setError(null);
    setIsLoading(true);

    try {
      if (isLogin) {
        // 1. Lấy token
        const res = await api.post('/auth/login', { email: email.trim(), password });
        const token = res.data.access_token;
        const refreshToken = res.data.refresh_token ?? null;

        // 2. Set tạm token vào store để axios interceptor gửi kèm Header
        login(
          { id: '', email: '', username: '', full_name: '', role: 'USER' } as any,
          token,
          refreshToken,
        );

        // 3. Lấy thông tin user thật
        const profileRes = await api.get('/auth/me');
        const user = profileRes.data;

        // 4. Update store với user thật
        login(user, token);

        // 5. Điều hướng: có ?next thì về đúng chỗ vừa đứng (thường là một
        // thớt bên diễn đàn), không thì Admin/Mod vào thẳng Dashboard.
        const role = user.role?.toLowerCase();
        if (nextUrl) {
          goAfterAuth('/');
        } else if (role === 'admin' || role === 'moderator') {
          navigate('/admin', { replace: true });
        } else {
          navigate(location.state?.from?.pathname || '/', { replace: true });
        }
      } else {
        // Form Đăng ký. /auth/register trả sẵn cặp token, nên đăng nhập luôn
        // thay vì bắt người dùng gõ lại mật khẩu và chờ băm bcrypt lần nữa.
        const username = email.split('@')[0];
        const res = await api.post('/auth/register', {
          email: email.trim(),
          password,
          username,
          full_name: fullName.trim() || username,
        });

        const token = res.data.access_token;
        if (!token) {
          setIsLogin(true);
          setError('Đăng ký thành công! Vui lòng đăng nhập.');
          return;
        }

        login(
          { id: '', email: '', username, full_name: '', role: 'USER' } as any,
          token,
          res.data.refresh_token ?? null,
        );
        const profileRes = await api.get('/auth/me');
        login(profileRes.data, token);
        goAfterAuth('/');
      }
    } catch (err: any) {
      setError(describeApiError(err, 'Có lỗi xảy ra. Vui lòng kiểm tra lại thông tin.'));
      // Xoá token dở dang, dù hỏng ở bước đăng nhập hay đăng ký.
      useAuthStore.getState().logout();
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass =
    'w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-[13px] outline-none';

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Cột Form */}
      <div className="flex-1 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-16 xl:px-20">
        <div className="mx-auto w-full max-w-sm">
          <div className="flex items-center justify-between gap-3 mb-6">
            <Link to="/" className="flex items-center gap-2 text-primary hover:opacity-80 transition-opacity">
              <div className="bg-primary/10 p-1.5 rounded-lg">
                <HeartPulse size={22} className="text-primary" />
              </div>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-600">
                SứcKhỏe<span className="text-slate-800">VN</span>
              </span>
            </Link>
            {/* Lối thoát tường minh: đứng ở đây mà đổi ý thì không phải sửa URL. */}
            <Link
              to="/"
              className="flex items-center gap-1 text-[12px] font-medium text-slate-500 hover:text-primary transition-colors"
            >
              <ArrowLeft size={14} /> Trang chủ
            </Link>
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-slate-900 mb-1">
            {isLogin ? 'Đăng nhập' : 'Tạo tài khoản mới'}
          </h2>
          <p className="text-[13px] text-slate-500 mb-6">
            {isLogin ? 'Chào mừng bạn quay trở lại với cộng đồng' : 'Bắt đầu hành trình chăm sóc sức khỏe của bạn'}
          </p>

          {error && (
            <div className={`mb-5 p-3 rounded-lg text-[13px] font-medium flex items-start gap-2 ${error.includes('thành công') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              <span>{error}</span>
            </div>
          )}

          {hasGoogle && (
            <>
              <a
                href={googleHref}
                className="w-full flex items-center justify-center gap-2.5 py-2 px-4 bg-white border border-slate-300 rounded-lg text-[13px] font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-colors"
              >
                <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
                  <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.4a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.6-5.2 3.6-8.8z" />
                  <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3a7.2 7.2 0 0 1-10.7-3.8h-4v3.1A12 12 0 0 0 12 24z" />
                  <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6v-3.1h-4a12 12 0 0 0 0 10.8l4-3.1z" />
                  <path fill="#EA4335" d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.5-3.5A12 12 0 0 0 1.3 6.6l4 3.1A7.2 7.2 0 0 1 12 4.8z" />
                </svg>
                Tiếp tục với Google
              </a>

              <div className="flex items-center gap-3 my-5">
                <span className="h-px flex-1 bg-slate-200" />
                <span className="text-[11px] uppercase tracking-wide text-slate-400">hoặc</span>
                <span className="h-px flex-1 bg-slate-200" />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {!isLogin && (
              <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-1">Họ và tên</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={inputClass}
                    placeholder="Nguyễn Văn A"
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1">Mật khẩu</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-primary text-white text-[13px] font-semibold rounded-lg hover:bg-primary-dark transition-all disabled:opacity-70 mt-1 shadow-sm shadow-primary/30"
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {isLogin ? 'Đang đăng nhập...' : 'Đang tạo tài khoản...'}
                </>
              ) : (
                <>
                  {isLogin ? 'Đăng nhập' : 'Đăng ký'}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-[13px] text-slate-600">
            {isLogin ? 'Chưa có tài khoản? ' : 'Đã có tài khoản? '}
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError(null);
              }}
              className="font-semibold text-primary hover:underline"
            >
              {isLogin ? 'Đăng ký ngay' : 'Đăng nhập'}
            </button>
          </div>
        </div>
      </div>

      {/* Cột Hình ảnh */}
      <div className="hidden lg:block relative w-0 flex-1 bg-gradient-to-br from-blue-600 to-indigo-900 overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1576091160550-2173ff9e5ee5?q=80&w=2069&auto=format&fit=crop')] bg-cover bg-center opacity-20 mix-blend-overlay"></div>
        <div className="absolute inset-0 flex flex-col justify-center px-16 lg:px-20">
          <h3 className="text-3xl font-bold text-white mb-5 leading-tight">
            Nơi chia sẻ & giải đáp<br />mọi vấn đề sức khỏe
          </h3>
          <p className="text-blue-100 text-base max-w-lg mb-7 leading-relaxed">
            Tham gia cộng đồng hàng nghìn y bác sĩ và thành viên để cập nhật kiến thức y khoa, nhận lời khuyên hữu ích và xây dựng lối sống lành mạnh.
          </p>
          <div className="flex gap-3">
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-3.5 w-44 text-white">
              <div className="text-2xl font-bold mb-0.5">10k+</div>
              <div className="text-[12px] text-blue-200">Thành viên tích cực</div>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-3.5 w-44 text-white">
              <div className="text-2xl font-bold mb-0.5">500+</div>
              <div className="text-[12px] text-blue-200">Bác sĩ chuyên khoa</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
