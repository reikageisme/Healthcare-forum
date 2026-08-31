import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import AdminLayout from './layouts/AdminLayout';
import AdminRouteGuard from './components/admin/AdminRouteGuard';
import AdminOnlyGuard from './components/admin/AdminOnlyGuard';

// Client pages
import HomePage from './pages/HomePage';
import PostDetailPage from './pages/PostDetailPage';
import CreatePostPage from './pages/CreatePostPage';
import EditPostPage from './pages/EditPostPage';
import BookmarksPage from './pages/BookmarksPage';
import TagPage from './pages/TagPage';
import CategoryPage from './pages/CategoryPage';
import { ScrollToTop } from './components/common/ScrollToTop';

// Admin pages
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminModerationPage from './pages/admin/AdminModerationPage';
import AdminPostsPage from './pages/admin/AdminPostsPage';
import AdminReportsPage from './pages/admin/AdminReportsPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminCategoriesPage from './pages/admin/AdminCategoriesPage';

// Auth
import LoginPage from './pages/LoginPage';

function App() {
  return (
    <>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      
      {/* Client / Public Routes */}
      <Route path="/" element={<MainLayout />}>
        {/* Home & Filters */}
        <Route index element={<HomePage />} />
        <Route path="hoi-dap" element={<HomePage />} />
        <Route path="bai-viet" element={<HomePage />} />
        <Route path="danh-gia" element={<HomePage />} />

        {/* Posts CRUD */}
        <Route path="create-post" element={<CreatePostPage />} />
        <Route path="posts/:id" element={<PostDetailPage />} />
        <Route path="posts/:id/edit" element={<EditPostPage />} />

        {/* Bookmarks */}
        <Route path="bookmarks" element={<BookmarksPage />} />
        <Route path="da-luu" element={<BookmarksPage />} />

        {/* Tags & Categories */}
        <Route path="tags/:slug" element={<TagPage />} />
        <Route path="category/:slug" element={<CategoryPage />} />
        <Route path="chuyen-khoa/:slug" element={<CategoryPage />} />

        {/* 404 Fallback */}
        <Route
          path="*"
          element={
            <div className="bg-surface rounded-2xl p-12 text-center border border-border shadow-sm max-w-xl mx-auto my-8">
              <h2 className="text-2xl font-extrabold text-text mb-2">404 - Không tìm thấy trang</h2>
              <p className="text-sm text-text-secondary mb-6">
                Đường dẫn bạn yêu cầu không tồn tại hoặc đã được di chuyển.
              </p>
              <a
                href="/"
                className="px-5 py-2.5 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-xl transition-colors inline-block"
              >
                Trở về Trang chủ
              </a>
            </div>
          }
        />
      </Route>

      {/* Protected Admin Routes */}
      <Route
        path="/admin"
        element={
          <AdminRouteGuard>
            <AdminLayout />
          </AdminRouteGuard>
        }
      >
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboardPage />} />
        <Route path="moderation" element={<AdminModerationPage />} />
        <Route path="posts" element={<AdminPostsPage />} />
        <Route path="reports" element={<AdminReportsPage />} />
        <Route
          path="users"
          element={
            <AdminOnlyGuard>
              <AdminUsersPage />
            </AdminOnlyGuard>
          }
        />
        <Route
          path="categories"
          element={
            <AdminOnlyGuard>
              <AdminCategoriesPage />
            </AdminOnlyGuard>
          }
        />
      </Route>
    </Routes>
    <ScrollToTop />
    </>
  );
}

export default App;

