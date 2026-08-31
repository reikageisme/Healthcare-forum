import React from 'react';
import { Menu, Globe, ShieldCheck, Crown } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getAvatarUrl } from '../../lib/utils';

interface AdminHeaderProps {
  onToggleSidebar: () => void;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({ onToggleSidebar }) => {
  const { user, isAdmin } = useAuth();
  const location = useLocation();

  const getPageTitle = (pathname: string) => {
    if (pathname.includes('/admin/dashboard')) return 'Tổng quan hệ thống';
    if (pathname.includes('/admin/moderation')) return 'Hàng chờ kiểm duyệt bài viết';
    if (pathname.includes('/admin/posts')) return 'Quản lý bài viết';
    if (pathname.includes('/admin/reports')) return 'Quản lý báo cáo vi phạm';
    if (pathname.includes('/admin/users')) return 'Quản lý người dùng';
    if (pathname.includes('/admin/categories')) return 'Quản lý chuyên mục';
    return 'Quản trị hệ thống';
  };

  return (
    <header className="h-16 bg-white border-b border-border sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 lg:px-8">
      {/* Left: Mobile hamburger & Title */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
          title="Mở menu"
        >
          <Menu size={20} />
        </button>

        <div>
          <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
            {getPageTitle(location.pathname)}
          </h1>
          <p className="text-xs text-slate-500 hidden sm:block">
            Khu vực Quản trị & Điều hành Diễn đàn SứcKhỏeVN
          </p>
        </div>
      </div>

      {/* Right: Quick link back to forum & user avatar */}
      <div className="flex items-center gap-3 sm:gap-4">
        <Link
          to="/"
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
        >
          <Globe size={14} />
          <span>Về diễn đàn</span>
        </Link>

        <div className="h-6 w-px bg-border hidden sm:block" />

        <div className="flex items-center gap-2.5">
          <img
            src={getAvatarUrl(user, user?.full_name || user?.username || 'Staff')}
            alt="Avatar"
            className="w-8 h-8 rounded-full object-cover border border-border"
          />
          <div className="hidden md:flex flex-col text-left">
            <span className="text-xs font-bold text-slate-800 leading-tight truncate max-w-[120px]">
              {user?.full_name || user?.username}
            </span>
            <span className="text-[10px] text-slate-500 flex items-center gap-1">
              {isAdmin ? (
                <>
                  <Crown size={10} className="text-amber-600" /> Admin
                </>
              ) : (
                <>
                  <ShieldCheck size={10} className="text-primary" /> Moderator
                </>
              )}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default AdminHeader;
