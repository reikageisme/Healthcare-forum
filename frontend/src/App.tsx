import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ScrollToTop } from './components/common/ScrollToTop';
import PortalApp from './apps/PortalApp';
import ForumApp from './apps/ForumApp';
import { IS_FORUM } from './lib/siteLinks';
import useSilentLogin from './hooks/useSilentLogin';

/**
 * Một mã nguồn, hai bản dựng.
 *
 * VITE_APP=forum cho ra bản chạy ở forums.medicvn.com, mặc định là cổng tin
 * tức medicvn.com. Chọn ở đây chứ không phải trong main.tsx để phần bọc
 * (ErrorBoundary, ScrollToTop) dùng chung cho cả hai, và để Vite loại bỏ
 * nhánh không dùng khi dựng — bản diễn đàn không mang theo trang quản trị.
 */
function App() {
  // Nhận lại phiên từ cookie tên miền cha. Đặt ở đây chứ không phải trong
  // MainLayout: trang đăng nhập và khu quản trị nằm ngoài layout đó, mà cả
  // hai đều cần biết người dùng là ai trước khi quyết định chặn hay cho qua.
  useSilentLogin();

  return (
    <>
      <ErrorBoundary>{IS_FORUM ? <ForumApp /> : <PortalApp />}</ErrorBoundary>
      <ScrollToTop />
    </>
  );
}

export default App;
