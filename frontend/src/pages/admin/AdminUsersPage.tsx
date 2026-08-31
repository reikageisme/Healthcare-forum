import React, { useEffect, useState } from 'react';
import { Search, UserCheck, Shield, Crown, User as UserIcon, Lock, Unlock, Edit2, RefreshCw } from 'lucide-react';
import { adminService } from '../../services/adminService';
import { User, UserRole } from '../../types';
import EditUserModal from '../../components/admin/EditUserModal';
import { formatDate, getAvatarUrl } from '../../lib/utils';
import { useAuth } from '../../hooks/useAuth';

export const AdminUsersPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Modal
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const res = await adminService.getUsers({
        search: searchKeyword.trim() || undefined,
        role: roleFilter || undefined,
        is_active: statusFilter === '' ? undefined : statusFilter === 'active',
        page,
        limit: 20,
      });

      setUsers(res.items || []);
      setTotal(res.total || (res.items ? res.items.length : 0));
    } catch (err) {
      console.error('Failed to load users', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [roleFilter, statusFilter, page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const handleSaveUser = async (
    userId: string,
    data: { role: UserRole; specialty?: string; bio?: string; is_active?: boolean }
  ) => {
    try {
      setIsActionLoading(true);
      await adminService.updateUser(userId, data);
      alert('Đã cập nhật thông tin thành viên thành công!');
      setEditingUser(null);
      fetchUsers();
    } catch (err: any) {
      console.error('Update user failed', err);
      const msg = err.response?.data?.detail || 'Không thể cập nhật thành viên.';
      alert(msg);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleToggleStatus = async (user: User) => {
    if (user.id === currentUser?.id) {
      alert('Bạn không thể tự khóa tài khoản của chính mình.');
      return;
    }

    const nextState = !(user.is_active !== false);
    const actionName = nextState ? 'mở khóa' : 'khóa';

    if (window.confirm(`Bạn có chắc chắn muốn ${actionName} tài khoản @${user.username}?`)) {
      try {
        setIsActionLoading(true);
        await adminService.toggleUserStatus(user.id, nextState);
        fetchUsers();
      } catch (err: any) {
        console.error('Toggle status failed', err);
        const msg = err.response?.data?.detail || 'Không thể thay đổi trạng thái tài khoản.';
        alert(msg);
      } finally {
        setIsActionLoading(false);
      }
    }
  };

  const getRoleBadge = (role?: string) => {
    const r = role?.toLowerCase();
    switch (r) {
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-purple-200">
            <Crown size={11} className="text-purple-600" /> Admin
          </span>
        );
      case 'moderator':
        return (
          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200">
            <Shield size={11} className="text-amber-600" /> Moderator
          </span>
        );
      case 'doctor':
        return (
          <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-200">
            <UserCheck size={11} className="text-blue-600" /> Bác sĩ
          </span>
        );
      case 'user':
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-slate-200">
            <UserIcon size={11} className="text-slate-500" /> Thành viên
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Quản lý Người dùng & Phân quyền
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Phân quyền Bác sĩ, Kiểm duyệt viên và kiểm soát trạng thái hoạt động tài khoản
          </p>
        </div>

        <button
          type="button"
          onClick={fetchUsers}
          disabled={isLoading}
          className="flex items-center gap-2 px-3.5 py-2 bg-white border border-border hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition-colors shadow-xs"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin text-primary' : ''} />
          <span>Làm mới</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-border shadow-xs flex items-center justify-between gap-3 flex-wrap">
        <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[240px] relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search size={15} />
          </div>
          <input
            type="text"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder="Tìm theo tên đăng nhập, họ tên, email..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </form>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 text-slate-700 font-medium"
          >
            <option value="">Tất cả vai trò</option>
            <option value="user">Thành viên (User)</option>
            <option value="doctor">Bác sĩ (Doctor)</option>
            <option value="moderator">Kiểm duyệt viên (Mod)</option>
            <option value="admin">Quản trị viên (Admin)</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 text-slate-700 font-medium"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="active">Đang hoạt động</option>
            <option value="banned">Đã bị khóa</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-border shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-xs italic">
            Đang tải dữ liệu thành viên...
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            Không tìm thấy người dùng nào phù hợp.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-border text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Thành viên</th>
                  <th className="py-3.5 px-4">Email</th>
                  <th className="py-3.5 px-4">Vai trò</th>
                  <th className="py-3.5 px-4">Chuyên khoa</th>
                  <th className="py-3.5 px-4">Trạng thái</th>
                  <th className="py-3.5 px-4">Ngày tham gia</th>
                  <th className="py-3.5 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((u) => {
                  const isActive = u.is_active !== false;
                  const isSelf = u.id === currentUser?.id;

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <img
                            src={getAvatarUrl(u, u.full_name || u.username)}
                            alt="Avatar"
                            className="w-8 h-8 rounded-full object-cover border border-border"
                          />
                          <div>
                            <p className="font-bold text-slate-900 leading-snug">
                              {u.full_name || u.username}
                            </p>
                            <p className="text-slate-400 text-[11px]">@{u.username}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-600 font-medium">
                        {u.email}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getRoleBadge(u.role)}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-600">
                        {u.specialty || '—'}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isActive ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                            Hoạt động
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                            Đã khóa
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-500">
                        {formatDate(u.created_at)}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => setEditingUser(u)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-primary hover:text-white text-slate-700 rounded-lg font-bold text-xs transition-colors inline-flex items-center gap-1"
                          title="Sửa vai trò & thông tin"
                        >
                          <Edit2 size={12} />
                          <span>Phân quyền</span>
                        </button>

                        {!isSelf && (
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(u)}
                            disabled={isActionLoading}
                            className={`p-1.5 rounded-lg text-xs font-bold transition-colors inline-flex items-center ${
                              isActive
                                ? 'text-danger hover:bg-red-50'
                                : 'text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={isActive ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                          >
                            {isActive ? <Lock size={14} /> : <Unlock size={14} />}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <EditUserModal
          isOpen={!!editingUser}
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSave={handleSaveUser}
          isSubmitting={isActionLoading}
        />
      )}
    </div>
  );
};

export default AdminUsersPage;
