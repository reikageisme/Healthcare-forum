import React, { useState } from 'react';
import { Search, Menu, UserCircle, LogOut, Plus, ShieldCheck, Newspaper, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getAvatarUrl } from '../../lib/utils';
import { logoutEverywhere } from '../../services/authService';
import SiteLink from '../common/SiteLink';
import { IS_FORUM, loginHref, portalHref, registerHref } from '../../lib/siteLinks';
import { canPostHere, writeElsewhereHref } from '../../lib/canPost';
import NotificationBell from './NotificationBell';
import ThemeToggle from '../common/ThemeToggle';

interface HeaderProps {
  toggleMobileMenu: () => void;
}

export const Header: React.FC<HeaderProps> = ({ toggleMobileMenu }) => {
  const { isAuthenticated, user, canModerate } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const navigate = useNavigate();

  /**
   * Đăng xuất phải chạm tới server, không chỉ xoá store.
   *
   * Refresh token nằm trong cookie ở tên miền cha; xoá mỗi state phía trình
   * duyệt thì mở lại trang là useSilentLogin lấy cookie ra đăng nhập lại
   * ngay. Gọi /auth/logout mới thực sự thoát, và thoát cho cả hai tên miền.
   */
  const handleLogout = async () => {
    setShowUserDropdown(false);
    await logoutEverywhere().catch(() => undefined);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/?search=${encodeURIComponent(searchTerm.trim())}`);
      setShowMobileSearch(false);
    } else {
      navigate('/');
    }
  };

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-border bg-surface/90 shadow-[0_8px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl">
        <div className="mx-auto max-w-[1480px] px-3 sm:px-6 lg:px-8">
          <div className="flex h-[72px] items-center justify-between gap-2 sm:gap-4">
            {/* Left section: Mobile menu & Logo */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleMobileMenu}
                aria-label="Mở menu điều hướng"
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-text-secondary transition-colors hover:bg-sidebar hover:text-primary lg:hidden"
              >
                <Menu size={22} />
              </button>
              <Link to="/" className="flex items-center shrink-0" aria-label="Medic Việt Nam — về trang chủ">
                {/*
                  Logo ngang gồm cả dòng tagline, nên cần cao hơn một icon
                  vuông thì chữ mới đọc được. width/height khai báo sẵn để
                  trình duyệt giữ chỗ, không giật layout khi ảnh tải xong.
                */}
                <img
                  src="/logo-wide.png"
                  alt="Medic Việt Nam"
                  width={648}
                  height={132}
                  className="h-9 w-auto sm:h-11"
                />
              </Link>

              {/*
                Nhãn cho biết mình đang đứng ở tên miền nào. Hai trang cố ý
                giống hệt nhau về màu và bố cục, nên nếu không có nhãn này thì
                người dùng không nhận ra mình vừa chuyển sang diễn đàn.
              */}
              {IS_FORUM && (
                <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold whitespace-nowrap">
                  Diễn đàn
                </span>
              )}
            </div>

            {/* Center section: Search Bar */}
            <div className="mx-3 hidden max-w-2xl flex-1 md:block xl:mx-8">
              <form onSubmit={handleSearchSubmit} className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-text-secondary" />
                </div>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  aria-label="Tìm kiếm trên Medic Việt Nam"
                  className="block w-full rounded-full border border-border bg-bg py-2.5 pl-10 pr-4 text-sm text-text placeholder-text-secondary transition-all focus:border-primary focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Tìm kiếm bài viết, triệu chứng, thuốc, bác sĩ..."
                />
              </form>
            </div>

            {/* Right section: Create post button & User auth */}
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setShowMobileSearch((value) => !value)}
                aria-label={showMobileSearch ? 'Đóng tìm kiếm' : 'Mở tìm kiếm'}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-text-secondary transition-colors hover:text-primary md:hidden"
              >
                {showMobileSearch ? <X size={18} /> : <Search size={18} />}
              </button>

              {/* Lối quay về cổng tin tức — chỉ có ở bản diễn đàn. */}
              {IS_FORUM && (
                <SiteLink
                  to={portalHref('/')}
                  className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 text-text-secondary hover:text-primary text-xs sm:text-sm font-semibold rounded-full hover:bg-primary/5 transition-colors"
                >
                  <Newspaper size={16} />
                  <span>Trang tin</span>
                </SiteLink>
              )}

              {/*
                Nút viết bài.

                Ở cổng tin tức, thành viên thường không đăng được — nút đưa họ
                sang diễn đàn thay vì mở một cái form rồi báo lỗi ở bước cuối.
              */}
              {canPostHere(user) ? (
                <Link
                  to="/create-post"
                  className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-primary hover:bg-primary-dark text-white rounded-full text-xs sm:text-sm font-semibold shadow-sm transition-colors"
                >
                  <Plus size={16} />
                  <span>{IS_FORUM ? 'Tạo chủ đề' : 'Viết bài'}</span>
                </Link>
              ) : (
                <a
                  href={writeElsewhereHref()}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-primary hover:bg-primary-dark text-white rounded-full text-xs sm:text-sm font-semibold shadow-sm transition-colors"
                >
                  <Plus size={16} />
                  <span>Đăng ở diễn đàn</span>
                </a>
              )}

              <NotificationBell />

              <ThemeToggle className="hidden sm:inline-flex" />

              <div className="h-6 w-px bg-border mx-1 hidden sm:block" />

              {isAuthenticated && user ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowUserDropdown(!showUserDropdown)}
                    className="flex items-center gap-2 cursor-pointer p-1 rounded-full hover:ring-2 hover:ring-primary/40 transition-all"
                  >
                    <img
                      src={getAvatarUrl(user, user.full_name || user.username)}
                      alt={user.full_name || 'User'}
                      className="w-8 h-8 rounded-full border border-border object-cover"
                    />
                  </button>

                  {/* Dropdown */}
                  {showUserDropdown && (
                    <div className="absolute right-0 z-50 mt-2 w-56 rounded-2xl border border-border bg-surface py-2 shadow-2xl animate-in fade-in zoom-in-95">
                      <div className="px-4 py-2 border-b border-border">
                        <p className="text-sm font-bold text-text truncate">
                          {user.full_name || user.username}
                        </p>
                        <p className="text-xs text-text-secondary truncate">{user.email}</p>
                      </div>

                      {/* Trang quản trị chỉ có ở cổng tin tức, kể cả khi đang
                          đứng ở diễn đàn — nó là nơi giữ danh tính và cây
                          chuyên mục cho cả hai trang. */}
                      {canModerate && (
                        <SiteLink
                          to={portalHref('/admin/dashboard')}
                          onClick={() => setShowUserDropdown(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-primary font-bold hover:bg-primary/5 transition-colors border-b border-border/60"
                        >
                          <ShieldCheck size={16} className="text-primary" />
                          <span>Trang quản trị (Admin)</span>
                        </SiteLink>
                      )}

                      <Link
                        to={`/users/${user.id}`}
                        onClick={() => setShowUserDropdown(false)}
                        className="block px-4 py-2 text-sm text-text-secondary hover:text-primary hover:bg-slate-50 transition-colors"
                      >
                        Trang cá nhân
                      </Link>
                      <Link
                        to="/settings/profile"
                        onClick={() => setShowUserDropdown(false)}
                        className="block px-4 py-2 text-sm text-text-secondary hover:text-primary hover:bg-slate-50 transition-colors"
                      >
                        Chỉnh sửa hồ sơ
                      </Link>
                      <Link
                        to="/bookmarks"
                        onClick={() => setShowUserDropdown(false)}
                        className="block px-4 py-2 text-sm text-text-secondary hover:text-primary hover:bg-slate-50 transition-colors"
                      >
                        Bài viết đã lưu
                      </Link>
                      <Link
                        to="/create-post"
                        onClick={() => setShowUserDropdown(false)}
                        className="block px-4 py-2 text-sm text-text-secondary hover:text-primary hover:bg-slate-50 transition-colors"
                      >
                        Tạo bài viết mới
                      </Link>

                      <div className="border-t border-border mt-1 pt-1">
                        <button
                          type="button"
                          onClick={handleLogout}
                          className="w-full text-left px-4 py-2 text-sm text-danger hover:bg-red-50 transition-colors flex items-center gap-2"
                        >
                          <LogOut size={16} />
                          <span>Đăng xuất</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <SiteLink
                    to={loginHref()}
                    className="hidden h-11 items-center rounded-xl px-3 text-sm font-semibold text-text-secondary transition-colors hover:bg-sidebar hover:text-primary sm:inline-flex"
                  >
                    Đăng nhập
                  </SiteLink>
                  <SiteLink
                    to={registerHref()}
                    className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-primary-dark sm:px-4 sm:text-sm"
                  >
                    <UserCircle size={18} aria-hidden="true" className="sm:hidden" />
                    <span className="hidden sm:inline">Đăng ký</span>
                    <span className="sm:hidden">Tham gia</span>
                  </SiteLink>
                </div>
              )}
            </div>
          </div>

          {showMobileSearch && (
            <div className="border-t border-border py-3 md:hidden">
              <form onSubmit={handleSearchSubmit} className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
                <input
                  autoFocus
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  aria-label="Tìm kiếm trên Medic Việt Nam"
                  placeholder="Tìm bài viết, triệu chứng, thuốc..."
                  className="w-full rounded-xl border border-border bg-bg py-3 pl-10 pr-4 text-sm text-text placeholder-text-secondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </form>
            </div>
          )}
        </div>
      </header>
    </>
  );
};

export default Header;
