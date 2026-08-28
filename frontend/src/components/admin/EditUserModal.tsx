import React, { useState, useEffect } from 'react';
import { X, UserCheck, Shield, Crown, User as UserIcon, AlertCircle } from 'lucide-react';
import { User, UserRole } from '../../types';

interface EditUserModalProps {
  isOpen: boolean;
  user: User | null;
  onClose: () => void;
  onSave: (
    userId: string,
    data: { role: UserRole; specialty?: string; bio?: string; is_active?: boolean }
  ) => Promise<void>;
  isSubmitting?: boolean;
}

export const EditUserModal: React.FC<EditUserModalProps> = ({
  isOpen,
  user,
  onClose,
  onSave,
  isSubmitting = false,
}) => {
  const [role, setRole] = useState<UserRole>('user');
  const [specialty, setSpecialty] = useState('');
  const [bio, setBio] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (user) {
      setRole((user.role?.toLowerCase() as UserRole) || 'user');
      setSpecialty(user.specialty || '');
      setBio(user.bio || '');
      setIsActive(user.is_active !== false);
    }
  }, [user]);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(user.id, {
      role,
      specialty: role === 'doctor' ? specialty.trim() : undefined,
      bio: bio.trim() || undefined,
      is_active: isActive,
    });
  };

  const isDoctorRole = role?.toLowerCase() === 'doctor';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-border">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-2.5 text-primary">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <UserCheck size={18} className="text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-900 leading-tight">
                Chỉnh sửa quyền & trạng thái
              </h3>
              <p className="text-xs text-slate-500">@{user.username} • {user.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          {/* Role selector */}
          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-2">
              Vai trò người dùng (Role)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label
                className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${
                  role === 'user'
                    ? 'border-primary bg-primary/5 text-primary font-bold'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="userRole"
                  value="user"
                  checked={role === 'user'}
                  onChange={() => setRole('user')}
                  className="text-primary"
                />
                <UserIcon size={16} />
                <span>Thành viên (User)</span>
              </label>

              <label
                className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${
                  role === 'doctor'
                    ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="userRole"
                  value="doctor"
                  checked={role === 'doctor'}
                  onChange={() => setRole('doctor')}
                  className="text-blue-600"
                />
                <UserCheck size={16} className="text-blue-600" />
                <span>Bác sĩ (Doctor)</span>
              </label>

              <label
                className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${
                  role === 'moderator'
                    ? 'border-amber-600 bg-amber-50 text-amber-700 font-bold'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="userRole"
                  value="moderator"
                  checked={role === 'moderator'}
                  onChange={() => setRole('moderator')}
                  className="text-amber-600"
                />
                <Shield size={16} className="text-amber-600" />
                <span>Kiểm duyệt (Mod)</span>
              </label>

              <label
                className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${
                  role === 'admin'
                    ? 'border-purple-600 bg-purple-50 text-purple-700 font-bold'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="userRole"
                  value="admin"
                  checked={role === 'admin'}
                  onChange={() => setRole('admin')}
                  className="text-purple-600"
                />
                <Crown size={16} className="text-purple-600" />
                <span>Quản trị (Admin)</span>
              </label>
            </div>
          </div>

          {/* Specialty field for Doctor */}
          {isDoctorRole && (
            <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200 space-y-2">
              <label className="block font-bold text-blue-900">
                Chuyên khoa y tế (Bác sĩ) <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder="VD: Tim mạch, Nhi khoa, Da liễu, Nội tiết..."
                required={isDoctorRole}
                className="w-full text-xs p-2.5 rounded-lg border border-blue-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[11px] text-blue-700">
                Bài viết của Bác sĩ sẽ tự động được phê duyệt mà không qua hàng chờ kiểm duyệt.
              </p>
            </div>
          )}

          {/* Bio field */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Tiểu sử / Ghi chú chuyên môn</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Thông tin giới thiệu ngắn gọn..."
              rows={2}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {/* Account Status Toggle */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
            <div>
              <span className="font-bold text-slate-900 block">Trạng thái tài khoản</span>
              <span className="text-slate-500 text-[11px]">
                {isActive ? 'Tài khoản hoạt động bình thường' : 'Tài khoản bị khóa (Banned)'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                isActive
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200'
                  : 'bg-red-100 text-red-800 border border-red-300 hover:bg-red-200'
              }`}
            >
              {isActive ? 'Đang hoạt động' : 'Đã khóa tài khoản'}
            </button>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 font-bold text-white bg-primary hover:bg-primary-dark rounded-xl transition-colors shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditUserModal;
