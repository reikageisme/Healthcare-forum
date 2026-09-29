import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from '../components/Header/Header';
import SidebarLeft from '../components/Sidebar/SidebarLeft';
import SidebarRight from '../components/Sidebar/SidebarRight';
import Footer from '../components/common/Footer';
import { Users, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import SiteLink from '../components/common/SiteLink';
import { forumHref, IS_FORUM, portalHref, registerHref } from '../lib/siteLinks';

const JOIN_PROMPT_KEY = 'medicvn:community-prompt-dismissed:v2';

const MainLayout: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showJoinPrompt, setShowJoinPrompt] = useState(false);
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  useEffect(() => setIsMobileMenuOpen(false), [location.pathname, location.search]);

  useEffect(() => {
    setShowJoinPrompt(sessionStorage.getItem(JOIN_PROMPT_KEY) !== '1');
  }, []);

  const dismissJoinPrompt = () => {
    sessionStorage.setItem(JOIN_PROMPT_KEY, '1');
    setShowJoinPrompt(false);
  };

  const primaryJoinHref = isAuthenticated
    ? IS_FORUM
      ? forumHref('/create-post')
      : forumHref()
    : registerHref();
  const primaryJoinLabel = isAuthenticated
    ? IS_FORUM
      ? 'Viết bài chia sẻ'
      : 'Vào diễn đàn'
    : 'Đăng nhập / Đăng ký';
  const mobileJoinLabel = isAuthenticated ? (IS_FORUM ? 'Viết bài' : 'Diễn đàn') : 'Tham gia';

  return (
    <div className="flex min-h-screen flex-col bg-bg">
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
        <aside className="sticky top-24 hidden w-80 shrink-0 self-start 2xl:w-[22rem] xl:block">
          <SidebarRight />
        </aside>
      </div>

      <Footer />

      {showJoinPrompt && !isMobileMenuOpen && (
        <>
          <div className="h-24 lg:h-36" aria-hidden="true" />
          <section
            role="dialog"
            aria-labelledby="join-community-title"
            aria-describedby="join-community-description"
            className="fixed inset-x-3 bottom-3 z-[60] mx-auto flex max-w-3xl items-center gap-3 rounded-2xl border border-primary/20 bg-surface/95 p-3 shadow-2xl backdrop-blur-xl sm:p-4 lg:bottom-5 lg:gap-5 lg:px-6 lg:py-5"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary lg:h-14 lg:w-14">
              <Users size={24} aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 id="join-community-title" className="text-sm font-extrabold text-text lg:text-lg">
                {isAuthenticated ? 'Khám phá cộng đồng Medic Việt Nam' : 'Tham gia cộng đồng Medic Việt Nam'}
              </h2>
              <p id="join-community-description" className="mt-0.5 line-clamp-1 text-[11px] text-text-secondary sm:line-clamp-none sm:text-xs lg:text-sm">
                {IS_FORUM
                  ? 'Đặt câu hỏi, trao đổi kinh nghiệm và chia sẻ kiến thức cùng cộng đồng y khoa.'
                  : 'Ghé diễn đàn để đặt câu hỏi, trao đổi kinh nghiệm và kết nối cùng cộng đồng y khoa.'}
              </p>
              <div className="mt-3 hidden flex-wrap gap-2 sm:flex">
                <SiteLink
                  to={primaryJoinHref}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-bold text-white transition-colors hover:bg-primary-dark"
                >
                  {primaryJoinLabel}
                </SiteLink>
                <SiteLink
                  to={IS_FORUM ? portalHref('/') : isAuthenticated ? forumHref('/create-post') : forumHref()}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-4 text-sm font-semibold text-text transition-colors hover:border-primary/30 hover:text-primary"
                >
                  {IS_FORUM ? 'Đọc tin y tế' : isAuthenticated ? 'Viết bài chia sẻ' : 'Xem diễn đàn'}
                </SiteLink>
              </div>
            </div>
            <SiteLink
              to={primaryJoinHref}
              className="inline-flex min-h-11 shrink-0 items-center rounded-xl bg-primary px-3.5 text-xs font-bold text-white transition-colors hover:bg-primary-dark sm:hidden"
            >
              {mobileJoinLabel}
            </SiteLink>
            <button
              type="button"
              onClick={dismissJoinPrompt}
              aria-label="Đóng lời mời tham gia cộng đồng"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-text-secondary transition-colors hover:bg-sidebar hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </section>
        </>
      )}
    </div>
  );
};

export default MainLayout;
