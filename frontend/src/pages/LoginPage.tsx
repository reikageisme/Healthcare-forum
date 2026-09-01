import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import api from '../lib/api';
import { Loader2, HeartPulse, User, Lock, Mail, ArrowRight } from 'lucide-react';
import { describeApiError } from '../lib/apiError';

export const LoginPage: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((state) => state.login);

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

        // 5. Điều hướng: Admin/Mod vào thẳng Dashboard
        const role = user.role?.toLowerCase();
        if (role === 'admin' || role === 'moderator') {
          navigate('/admin');
        } else {
          navigate(location.state?.from?.pathname || '/');
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
        navigate('/');
      }
    } catch (err: any) {
      setError(describeApiError(err, 'Có lỗi xảy ra. Vui lòng kiểm tra lại thông tin.'));
      // Xoá token dở dang, dù hỏng ở bước đăng nhập hay đăng ký.
      useAuthStore.getState().logout();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Cột Form */}
      <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <div className="flex items-center gap-2 mb-8">
            <Link to="/" className="flex items-center gap-2 text-primary hover:opacity-80 transition-opacity">
              <div className="bg-primary/10 p-2 rounded-xl">
                <HeartPulse size={28} className="text-primary" />
              </div>
              <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-600">
                SứcKhỏe<span className="text-slate-800">VN</span>
              </span>
            </Link>
          </div>
          
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">
            {isLogin ? 'Đăng nhập' : 'Tạo tài khoản mới'}
          </h2>
          <p className="text-sm text-slate-500 mb-8">
            {isLogin ? 'Chào mừng bạn quay trở lại với cộng đồng' : 'Bắt đầu hành trình chăm sóc sức khỏe của bạn'}
          </p>

          {error && (
            <div className={`mb-6 p-4 rounded-xl text-sm font-medium flex items-start gap-3 ${error.includes('thành công') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Họ và tên</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm outline-none"
                    placeholder="Nguyễn Văn A"
                    required
                  />
                </div>
              </div>
            )}
            
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm outline-none"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Mật khẩu</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm outline-none"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-primary text-white font-semibold rounded-xl hover:bg-primary-dark transition-all disabled:opacity-70 mt-2 shadow-sm shadow-primary/30"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  {isLogin ? 'Đang đăng nhập...' : 'Đang tạo tài khoản...'}
                </>
              ) : (
                <>
                  {isLogin ? 'Đăng nhập' : 'Đăng ký'}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center text-sm text-slate-600">
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
        <div className="absolute inset-0 flex flex-col justify-center px-16 lg:px-24">
          <h3 className="text-4xl font-bold text-white mb-6 leading-tight">
            Nơi chia sẻ & giải đáp<br />mọi vấn đề sức khỏe
          </h3>
          <p className="text-blue-100 text-lg max-w-lg mb-8 leading-relaxed">
            Tham gia cộng đồng hàng nghìn y bác sĩ và thành viên để cập nhật kiến thức y khoa, nhận lời khuyên hữu ích và xây dựng lối sống lành mạnh.
          </p>
          <div className="flex gap-4">
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 w-48 text-white">
              <div className="text-3xl font-bold mb-1">10k+</div>
              <div className="text-sm text-blue-200">Thành viên tích cực</div>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 w-48 text-white">
              <div className="text-3xl font-bold mb-1">500+</div>
              <div className="text-sm text-blue-200">Bác sĩ chuyên khoa</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
