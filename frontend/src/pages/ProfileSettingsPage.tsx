import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, Camera, CheckCircle2, ChevronRight, Loader2, Trash2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { userService } from '../services/userService';
import { uploadService } from '../services/uploadService';
import { getAvatarUrl } from '../lib/utils';
import { EmptyState } from '../components/common/EmptyState';

/**
 * Chỉnh sửa hồ sơ cá nhân.
 *
 * Ảnh đại diện được tải lên ngay khi chọn file, trước khi bấm Lưu: người dùng
 * cần nhìn thấy ảnh mới trước khi cam kết, và endpoint /upload vốn đã trả về
 * URL nên không có lý do gì phải giữ file trong bộ nhớ chờ lượt lưu.
 *
 * Chỉ những trường thật sự có trong database mới xuất hiện ở đây. Ảnh bìa,
 * màu nhấn hay các công tắc riêng tư trong bản thiết kế đều cần thêm cột mới,
 * nên chưa đưa vào — thà thiếu ô còn hơn có ô bấm xong không lưu được.
 */

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const BIO_LIMIT = 500;

export const ProfileSettingsPage: React.FC = () => {
  const { user, setUser, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [specialty, setSpecialty] = useState(user?.specialty || '');
  const [workplace, setWorkplace] = useState(user?.workplace || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (!isAuthenticated || !user) {
    return (
      <EmptyState
        title="Bạn cần đăng nhập"
        description="Đăng nhập để chỉnh sửa hồ sơ cá nhân của mình."
        actionText="Đăng nhập"
        actionHref="/login"
      />
    );
  }

  const handlePickAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Chỉ nhận file ảnh (JPG, PNG, WebP hoặc GIF).');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError('Ảnh vượt quá 5 MB. Hãy chọn ảnh nhỏ hơn.');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      const res = await uploadService.uploadImage(file);
      setAvatarUrl(res.url);
      setSaved(false);
    } catch (err) {
      console.error('Avatar upload failed', err);
      setError('Tải ảnh lên thất bại. Vui lòng thử lại.');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      const updated = await userService.updateProfile(user.id, {
        full_name: fullName.trim(),
        bio: bio.trim(),
        specialty: specialty.trim(),
        workplace: workplace.trim(),
        avatar_url: avatarUrl,
      });
      // Cập nhật store để header và mọi bài viết đổi tên/ảnh ngay, khỏi F5.
      setUser({ ...user, ...updated });
      setSaved(true);
    } catch (err) {
      console.error('Failed to save profile', err);
      setError('Không lưu được hồ sơ. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  const previewUser = { ...user, avatar_url: avatarUrl, full_name: fullName };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-1.5 text-xs text-text-secondary mb-3">
        <Link to="/" className="hover:text-primary">Trang chủ</Link>
        <ChevronRight size={12} aria-hidden="true" />
        <Link to={`/users/${user.id}`} className="hover:text-primary">
          {user.full_name || user.username}
        </Link>
        <ChevronRight size={12} aria-hidden="true" />
        <span className="text-text font-medium">Chỉnh sửa hồ sơ</span>
      </div>

      <h1 className="text-2xl font-extrabold text-text tracking-tight mb-1">Chỉnh sửa hồ sơ</h1>
      <p className="text-[13px] text-text-secondary mb-5">
        Những gì người khác nhìn thấy trên hồ sơ và bên cạnh mỗi bài viết của bạn.
      </p>

      <form onSubmit={handleSave}>
        <section className="bg-surface rounded-2xl border border-border shadow-sm mb-4">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-[15px] font-bold text-text">Ảnh đại diện</h2>
            <p className="text-xs text-text-secondary mt-0.5">
              JPG, PNG, WebP hoặc GIF · tối đa 5&nbsp;MB · ảnh vuông hiển thị đẹp nhất
            </p>
          </div>
          <div className="p-6 flex flex-wrap items-center gap-5">
            <img
              src={getAvatarUrl(previewUser, fullName || user.username)}
              alt="Ảnh đại diện hiện tại"
              className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md bg-slate-100"
            />
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handlePickAvatar}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
              >
                {uploading ? (
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                ) : (
                  <Camera size={16} aria-hidden="true" />
                )}
                {uploading ? 'Đang tải lên...' : 'Tải ảnh lên'}
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => setAvatarUrl('')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-border text-danger rounded-xl text-sm font-semibold hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={16} aria-hidden="true" />
                  Gỡ ảnh
                </button>
              )}
            </div>
            <p className="text-[11px] text-text-secondary basis-full">
              Ảnh đại diện là công khai — đừng dùng ảnh có chứa thông tin bệnh án hay giấy tờ.
            </p>
          </div>
        </section>

        <section className="bg-surface rounded-2xl border border-border shadow-sm mb-4">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-[15px] font-bold text-text">Thông tin cơ bản</h2>
          </div>
          <div className="p-6 space-y-5">
            <div>
              <label htmlFor="full_name" className="block text-xs font-bold text-slate-700 mb-1.5">
                Tên hiển thị
              </label>
              <input
                id="full_name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                maxLength={255}
                placeholder={user.username}
                className="w-full h-11 px-3.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
              />
            </div>

            <div>
              <label htmlFor="username" className="block text-xs font-bold text-slate-700 mb-1.5">
                Tên đăng nhập
              </label>
              <input
                id="username"
                type="text"
                value={user.username}
                readOnly
                disabled
                className="w-full h-11 px-3.5 border border-border rounded-xl text-sm bg-slate-50 text-text-secondary"
              />
              <p className="text-[11px] text-text-secondary mt-1.5">
                Tên đăng nhập chưa đổi được từ đây — liên hệ ban quản trị nếu cần.
              </p>
            </div>

            <div>
              <div className="flex items-baseline justify-between mb-1.5">
                <label htmlFor="bio" className="block text-xs font-bold text-slate-700">
                  Giới thiệu bản thân
                </label>
                <span
                  className={`text-[11px] font-semibold tabular-nums ${
                    bio.length > BIO_LIMIT ? 'text-danger' : 'text-text-secondary'
                  }`}
                >
                  {bio.length} / {BIO_LIMIT}
                </span>
              </div>
              <textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={BIO_LIMIT}
                rows={4}
                placeholder="Vài dòng về bạn — chuyên môn, mối quan tâm, lý do bạn ở đây."
                className="w-full px-3.5 py-3 border border-border rounded-xl text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all resize-y"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="specialty" className="block text-xs font-bold text-slate-700 mb-1.5">
                  Chuyên khoa
                </label>
                <input
                  id="specialty"
                  type="text"
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  maxLength={100}
                  placeholder="Tim mạch, Nhi khoa, Da liễu..."
                  className="w-full h-11 px-3.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                />
              </div>
              <div>
                <label htmlFor="workplace" className="block text-xs font-bold text-slate-700 mb-1.5">
                  Nơi công tác
                </label>
                <input
                  id="workplace"
                  type="text"
                  value={workplace}
                  onChange={(e) => setWorkplace(e.target.value)}
                  maxLength={255}
                  placeholder="Bệnh viện, phòng khám hoặc trường bạn đang làm việc"
                  className="w-full h-11 px-3.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                />
              </div>
            </div>

            <div className="flex gap-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200">
              <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-xs text-amber-800 leading-relaxed">
                Điền chuyên khoa và nơi công tác <b>không</b> tạo ra huy hiệu &ldquo;BS. đã xác thực&rdquo;.
                Huy hiệu chỉ được cấp sau khi ban quản trị duyệt giấy phép hành nghề của bạn.
              </p>
            </div>
          </div>
        </section>

        {error && (
          <div
            role="alert"
            className="flex items-center gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 mb-4"
          >
            <AlertTriangle size={16} aria-hidden="true" />
            {error}
          </div>
        )}

        <div className="sticky bottom-0 bg-surface border border-border rounded-2xl shadow-sm px-5 py-3.5 flex flex-wrap items-center gap-3">
          {saved && !saving && (
            <span role="status" className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
              <CheckCircle2 size={15} aria-hidden="true" />
              Đã lưu hồ sơ
            </span>
          )}
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => navigate(`/users/${user.id}`)}
            className="px-4 py-2.5 bg-white border border-border rounded-xl text-sm font-semibold text-text-secondary hover:text-text transition-colors"
          >
            Xem hồ sơ
          </button>
          <button
            type="submit"
            disabled={saving || uploading}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
          >
            {saving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProfileSettingsPage;
