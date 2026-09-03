import React, { useEffect, useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
  Clock,
  Crown,
  FileText,
  Flag,
  Folder,
  Globe,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Users,
  X,
  Link2,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { adminService } from '../../services/adminService';
import { cn } from '../../lib/utils';

interface AdminSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ isOpen, onClose }) => {
  const { user, isAdmin, logout } = useAuth();
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [openReportsCount, setOpenReportsCount] = useState<number | null>(null);

  useEffect(() => {
    const fetchCounters = async () => {
      try {
        const stats = await adminService.getStats(7);
        const pending = stats.totals?.total_pending_posts ?? stats.pending_posts ?? stats.total_pending_posts ?? 0;
        const reports = stats.totals?.total_open_reports ?? stats.open_reports ?? stats.total_open_reports ?? 0;
        setPendingCount(pending);
        setOpenReportsCount(reports);
      } catch {
        // Non-critical, ignore error
      }
    };
    fetchCounters();
  }, []);

  const navItemClasses = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors group',
      isActive
        ? 'bg-primary text-white shadow-sm shadow-primary/25 font-semibold'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
    );

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed top-0 left-0 bottom-0 z-50 w-64 bg-white border-r border-border flex flex-col transition-transform duration-300 lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand & Role Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-border">
          <Link to="/admin/dashboard" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center shadow-sm">
              <HeartPulse className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-base text-text leading-none">Admin Hub</span>
              <span className="text-[11px] text-text-secondary mt-0.5">SứcKhỏeVN</span>
            </div>
          </Link>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-lg text-text-secondary hover:text-text hover:bg-slate-100"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* User Role Pill */}
        <div className="px-5 py-3.5 border-b border-border/60 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
              {isAdmin ? <Crown size={16} className="text-amber-600" /> : <ShieldCheck size={16} className="text-primary" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate">
                {user?.full_name || user?.username || 'Staff Member'}
              </p>
              <span
                className={cn(
                  'inline-block px-1.5 py-0.2 text-[10px] font-bold rounded uppercase mt-0.5',
                  isAdmin
                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                )}
              >
                {isAdmin ? 'Quản trị viên (Admin)' : 'Kiểm duyệt viên (Mod)'}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Groups */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          {/* Group 1: Moderation */}
          <div>
            <p className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Vận hành & Kiểm duyệt
            </p>
            <nav className="space-y-1">
              <NavLink to="/admin/dashboard" onClick={onClose} className={navItemClasses} end>
                {({ isActive }) => (
                  <div className="flex items-center gap-3">
                    <LayoutDashboard size={18} className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-primary'} />
                    <span>Tổng quan (Dashboard)</span>
                  </div>
                )}
              </NavLink>

              <NavLink to="/admin/moderation" onClick={onClose} className={navItemClasses}>
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-3">
                      <Clock size={18} className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-primary'} />
                      <span>Hàng chờ duyệt</span>
                    </div>
                    {typeof pendingCount === 'number' && pendingCount > 0 && (
                      <span
                        className={cn(
                          'px-2 py-0.5 text-xs font-bold rounded-full',
                          isActive ? 'bg-white text-primary' : 'bg-amber-100 text-amber-800'
                        )}
                      >
                        {pendingCount}
                      </span>
                    )}
                  </>
                )}
              </NavLink>

              <NavLink to="/admin/posts" onClick={onClose} className={navItemClasses}>
                {({ isActive }) => (
                  <div className="flex items-center gap-3">
                    <FileText size={18} className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-primary'} />
                    <span>Quản lý bài viết</span>
                  </div>
                )}
              </NavLink>

              <NavLink to="/admin/reports" onClick={onClose} className={navItemClasses}>
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-3">
                      <Flag size={18} className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-primary'} />
                      <span>Báo cáo vi phạm</span>
                    </div>
                    {typeof openReportsCount === 'number' && openReportsCount > 0 && (
                      <span
                        className={cn(
                          'px-2 py-0.5 text-xs font-bold rounded-full',
                          isActive ? 'bg-white text-primary' : 'bg-red-100 text-red-800'
                        )}
                      >
                        {openReportsCount}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            </nav>
          </div>

          {/* Group 2: Administration (Admin Only) */}
          {isAdmin && (
            <div>
              <p className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Hệ thống & Phân quyền
              </p>
              <nav className="space-y-1">
                <NavLink to="/admin/users" onClick={onClose} className={navItemClasses}>
                  {({ isActive }) => (
                    <div className="flex items-center gap-3">
                      <Users size={18} className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-primary'} />
                      <span>Quản lý người dùng</span>
                    </div>
                  )}
                </NavLink>

                <NavLink to="/admin/categories" onClick={onClose} className={navItemClasses}>
                  {({ isActive }) => (
                    <div className="flex items-center gap-3">
                      <Folder size={18} className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-primary'} />
                      <span>Quản lý chuyên mục</span>
                    </div>
                  )}
                </NavLink>

                <NavLink to="/admin/network" onClick={onClose} className={navItemClasses}>
                  {({ isActive }) => (
                    <div className="flex items-center gap-3">
                      <Link2 size={18} className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-primary'} />
                      <span>Mạng lưới &amp; Chân trang</span>
                    </div>
                  )}
                </NavLink>
              </nav>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border space-y-1 bg-slate-50/50">
          <Link
            to="/"
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:text-primary hover:bg-white transition-colors"
          >
            <Globe size={18} className="text-slate-400" />
            <span>Xem Diễn đàn (Client)</span>
          </Link>
          <button
            type="button"
            onClick={() => {
              logout();
              window.location.href = '/';
            }}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-danger hover:bg-red-50 transition-colors"
          >
            <LogOut size={18} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default AdminSidebar;
