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
      
      <div className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 flex gap-6 pt-24">
        {/* Left Sidebar */}
        <aside className={`fixed lg:sticky lg:top-24 top-16 left-0 h-[calc(100vh-6rem)] w-64 xl:w-72 shrink-0 bg-surface z-40 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0 border-r border-border' : '-translate-x-full'}`}>
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
        <aside className="hidden xl:block w-80 2xl:w-[22rem] shrink-0 sticky top-24 h-[calc(100vh-6rem)] overflow-y-auto">
          <SidebarRight />
        </aside>
      </div>

      <Footer />
    </div>
  );
};

export default MainLayout;
