import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from '../components/Header/Header';
import SidebarLeft from '../components/Sidebar/SidebarLeft';
import SidebarRight from '../components/Sidebar/SidebarRight';
import Footer from '../components/common/Footer';
import { Users } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import SiteLink from '../components/common/SiteLink';
import { loginHref } from '../lib/siteLinks';

const MainLayout: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  useEffect(() => setIsMobileMenuOpen(false), [location.pathname, location.search]);

  return (
    <div className="flex min-h-screen flex-col bg-bg pb-20 lg:pb-0">
      <a
        href="#main-content"
        className="sr-only fixed left-4 top-4 z-[100] rounded-lg bg-primary px-4 py-2 text-white focus:not-sr-only"
      >
        Bỏ qua điều hướng
      </a>
      <Header toggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />
      
      {/*
        Ba cột, căn giữa, và nới rộng dần theo bề ngang màn hình.

        Đã thử dán sidebar vào sát hai mép kiểu Facebook: trên màn 2K nó hỏng.
        Facebook để lọt được vì họ chỉ có MỘT cột đọc hẹp; ở đây hai sidebar
        bị hất ra xa hàng trăm pixel còn phần giữa đứng chơ vơ, mắt phải quét
        ngang cả màn hình mới gom đủ thông tin, và mọi thứ trông bé xíu.

        Quay lại khung căn giữa. Khác một chỗ với bản cũ: trần nới thêm ở
        2xl thay vì đứng yên ở 1600px, nên màn càng rộng thì cả ba cột cùng
        rộng ra chứ không để thừa hai dải trống hai bên.
      */}
      <div className="mx-auto flex w-full max-w-[1480px] flex-1 gap-5 px-3 pb-8 pt-24 sm:px-6 lg:gap-6 lg:px-8">
        {/* Left Sidebar */}
        <aside className={`fixed left-0 top-[72px] z-40 h-[calc(100vh-72px)] w-72 shrink-0 transform border-r border-border bg-surface transition-transform duration-300 ease-in-out lg:sticky lg:top-24 lg:h-[calc(100vh-7rem)] lg:w-60 lg:translate-x-0 lg:rounded-2xl lg:border xl:w-64 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="h-full overflow-y-auto px-4 py-5">
            <SidebarLeft />
          </div>
        </aside>

        {/* Backdrop for mobile */}
        {isMobileMenuOpen && (
          <button
            type="button"
            aria-label="Đóng menu"
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Main Content */}
        <main id="main-content" className="min-w-0 flex-1" tabIndex={-1}>
          <Outlet />
        </main>

        {/* Right Sidebar */}
        <aside className="hidden xl:block w-80 2xl:w-[22rem] shrink-0 sticky top-24 h-[calc(100vh-6rem)] overflow-y-auto">
          <SidebarRight />
        </aside>
      </div>

      <Footer />

      {!isAuthenticated && !isMobileMenuOpen && (
        <div className="fixed inset-x-3 bottom-3 z-40 flex items-center gap-3 rounded-2xl border border-border bg-surface/95 p-3 shadow-2xl backdrop-blur-lg lg:hidden">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Users size={19} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-text">Tham gia cộng đồng</p>
            <p className="truncate text-[11px] text-text-secondary">Đặt câu hỏi và kết nối cùng bác sĩ.</p>
          </div>
          <SiteLink
            to={loginHref()}
            className="shrink-0 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-white hover:bg-primary-dark"
          >
            Tham gia
          </SiteLink>
        </div>
      )}
    </div>
  );
};

export default MainLayout;
