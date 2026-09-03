import React, { useState } from 'react';
import { Search, Bell, Menu, HeartPulse, UserCircle, LogOut, Plus, ShieldCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getAvatarUrl } from '../../lib/utils';

interface HeaderProps {
  toggleMobileMenu: () => void;
}

export const Header: React.FC<HeaderProps> = ({ toggleMobileMenu }) => {
  const { isAuthenticated, user, logout, canModerate } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const navigate = useNavigate();

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/?search=${encodeURIComponent(searchTerm.trim())}`);
    } else {
      navigate('/');
    }
  };

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-50 bg-surface/90 backdrop-blur-md border-b border-border shadow-sm">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-3">
            {/* Left section: Mobile menu & Logo */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleMobileMenu}
                className="lg:hidden p-2 text-text-secondary hover:text-primary rounded-lg"
              >
                <Menu size={22} />
              </button>
              <Link to="/" className="flex items-center gap-2.5 group">
                <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center shadow-md shadow-primary/25">
                  <HeartPulse className="w-5 h-5" />
                </div>
                <span className="font-extrabold text-xl text-primary tracking-tight hidden sm:block">
                  SứcKhỏeVN
                </span>
              </Link>
            </div>

            {/* Center section: Search Bar */}
            <div className="flex-1 max-w-2xl mx-4 hidden md:block">
              <form onSubmit={handleSearchSubmit} className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-text-secondary" />
                </div>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-10 pr-4 py-2 border border-border rounded-full bg-slate-50 focus:bg-white text-sm placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                  placeholder="Tìm kiếm bài viết, triệu chứng, thuốc, bác sĩ..."
                />
              </form>
            </div>

            {/* Right section: Create post button & User auth */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Write post button */}
              <Link
                to="/create-post"
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-primary hover:bg-primary-dark text-white rounded-full text-xs sm:text-sm font-semibold shadow-sm transition-colors"
              >
                <Plus size={16} />
                <span>Viết bài</span>
              </Link>

              <button
                type="button"
                className="p-2 text-text-secondary hover:text-primary hover:bg-primary/5 rounded-full transition-colors relative"
                title="Thông báo"
              >
                <Bell size={20} />
                <span className="absolute top-1.5 right-1.5 block h-2 w-2 rounded-full bg-danger ring-2 ring-surface" />
              </button>

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
                    <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-lg border border-border py-2 z-50 animate-in fade-in zoom-in-95">
                      <div className="px-4 py-2 border-b border-border">
                        <p className="text-sm font-bold text-text truncate">
                          {user.full_name || user.username}
                        </p>
                        <p className="text-xs text-text-secondary truncate">{user.email}</p>
                      </div>

                      {canModerate && (
                        <Link
                          to="/admin/dashboard"
                          onClick={() => setShowUserDropdown(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-primary font-bold hover:bg-primary/5 transition-colors border-b border-border/60"
                        >
                          <ShieldCheck size={16} className="text-primary" />
                          <span>Trang quản trị (Admin)</span>
                        </Link>
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
                          onClick={() => {
                            logout();
                            setShowUserDropdown(false);
                          }}
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
                <Link
                  to="/login"
                  className="flex items-center gap-1.5 bg-primary text-white px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold hover:bg-primary-dark shadow-sm transition-colors"
                >
                  <UserCircle size={18} />
                  <span>Đăng nhập</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>
    </>
  );
};

export default Header;
