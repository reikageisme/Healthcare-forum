import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from '../components/Header/Header';
import SidebarLeft from '../components/Sidebar/SidebarLeft';
import SidebarRight from '../components/Sidebar/SidebarRight';
import Footer from '../components/common/Footer';

const MainLayout: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <Header toggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />
      
      {/*
        Ba cột kiểu Facebook.

        Trước đây cả khung bị bó trong max-w-[1600px] rồi căn giữa, nên trên
        màn hình rộng hai sidebar bị kéo vào sát cột giữa và phần đọc nằm lệch
        về một bên. Bỏ trần đi: sidebar dán vào hai mép màn hình, phần giữa
        lấy hết khoảng còn lại, rồi TỪNG TRANG tự giới hạn bề ngang phần đọc
        (~700px) và căn giữa. Màn càng rộng thì hai bên càng giãn ra, còn chỗ
        để mắt nhìn thì luôn ở giữa và luôn cùng một bề ngang.
      */}
      <div className="flex-1 w-full px-3 sm:px-4 lg:px-5 py-5 flex gap-4 xl:gap-6 pt-20">
        {/* Left Sidebar */}
        <aside className={`fixed lg:sticky lg:top-20 top-16 left-0 h-[calc(100vh-5.5rem)] w-60 xl:w-64 shrink-0 bg-surface z-40 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0 border-r border-border' : '-translate-x-full'}`}>
          <div className="h-full overflow-y-auto px-4 py-4">
            <SidebarLeft />
          </div>
        </aside>

        {/* Backdrop for mobile */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>

        {/* Right Sidebar */}
        <aside className="hidden xl:block w-72 2xl:w-80 shrink-0 sticky top-20 h-[calc(100vh-5.5rem)] overflow-y-auto">
          <SidebarRight />
        </aside>
      </div>

      <Footer />
    </div>
  );
};

export default MainLayout;
