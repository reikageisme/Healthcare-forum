import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import ExternalRedirect from '../components/common/ExternalRedirect';
import { portalHref } from '../lib/siteLinks';

import ForumPage from '../pages/ForumPage';
import ForumCategoryPage from '../pages/ForumCategoryPage';
import PostDetailPage from '../pages/PostDetailPage';
import CreatePostPage from '../pages/CreatePostPage';
import EditPostPage from '../pages/EditPostPage';
import BookmarksPage from '../pages/BookmarksPage';
import TagPage from '../pages/TagPage';
import ProfilePage from '../pages/ProfilePage';
import ProfileSettingsPage from '../pages/ProfileSettingsPage';

/**
 * Diễn đàn forum.medicvn.com.
 *
 * Đường dẫn giữ nguyên "/forum/..." và "/posts/..." như hồi còn nằm chung
 * trang: mọi liên kết trong các component dùng chung vẫn đúng, và nginx của
 * trang tin chỉ việc chuyển hướng nguyên si phần đuôi sang đây. Đổi sang
 * "/c/..." cho ngắn thì phải sửa hàng chục chỗ và làm gãy mọi link đã chia sẻ
 * — không đáng.
 *
 * Không có route /admin: quản trị ở lại cổng tin tức, nơi giữ danh tính và
 * cây chuyên mục. Không có /login: diễn đàn không giữ mật khẩu.
 */
export const ForumApp = () => (
  <Routes>
    {/* Đăng nhập luôn diễn ra ở cổng tin tức. */}
    <Route path="/login" element={<ExternalRedirect origin={portalHref('/login')} keepPath={false} />} />

    <Route path="/" element={<MainLayout />}>
      {/* Gốc của tên miền con là trang chủ diễn đàn; /forum là địa chỉ chuẩn. */}
      <Route index element={<Navigate to="/forum" replace />} />
      <Route path="forum" element={<ForumPage />} />
      <Route path="forum/:slug" element={<ForumCategoryPage />} />

      {/* Thớt và trả lời vẫn là bài viết và bình luận. */}
      <Route path="posts/:id" element={<PostDetailPage />} />
      <Route path="posts/:id/edit" element={<EditPostPage />} />
      <Route path="create-post" element={<CreatePostPage />} />

      <Route path="bookmarks" element={<BookmarksPage />} />
      <Route path="da-luu" element={<BookmarksPage />} />
      <Route path="tags/:slug" element={<TagPage />} />

      <Route path="users/:id" element={<ProfilePage />} />
      <Route path="settings/profile" element={<ProfileSettingsPage />} />

      {/* Chuyên mục ở diễn đàn là một box, không phải trang danh mục tin tức. */}
      <Route path="category/:slug" element={<ForumCategoryPage />} />
      <Route path="chuyen-khoa/:slug" element={<ForumCategoryPage />} />

      <Route
        path="*"
        element={
          <div className="bg-surface rounded-2xl p-12 text-center border border-border shadow-sm max-w-xl mx-auto my-8">
            <h2 className="text-2xl font-extrabold text-text mb-2">404 - Không tìm thấy trang</h2>
            <p className="text-sm text-text-secondary mb-6">
              Đường dẫn bạn yêu cầu không tồn tại hoặc đã được di chuyển.
            </p>
            <a
              href="/forum"
              className="px-5 py-2.5 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-xl transition-colors inline-block"
            >
              Về trang chủ diễn đàn
            </a>
          </div>
        }
      />
    </Route>
  </Routes>
);

export default ForumApp;
