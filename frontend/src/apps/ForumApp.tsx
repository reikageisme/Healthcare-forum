import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import ExternalRedirect from '../components/common/ExternalRedirect';
import { portalHref } from '../lib/siteLinks';

import { useParams } from 'react-router-dom';
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
 * Diễn đàn forums.medicvn.com.
 *
 * Trang chủ diễn đàn nằm ở gốc tên miền con, không phải /forum: lặp lại chữ
 * "forum" trong địa chỉ của chính trang diễn đàn thì thừa. Box nằm ở /c/:slug.
 *
 * Hai đường dẫn cũ /forum và /forum/:slug vẫn được giữ làm lối chuyển hướng,
 * cho những link đã chia sẻ trước khi tách tên miền.
 *
 * Không có route /admin: quản trị ở lại cổng tin tức, nơi giữ danh tính và
 * cây chuyên mục. Không có /login: diễn đàn không giữ mật khẩu.
 */
/** /forum/tim-mach (cũ) -> /c/tim-mach. */
const LegacyBoxRedirect = () => {
  const { slug } = useParams();
  return <Navigate to={slug ? `/c/${slug}` : '/'} replace />;
};

export const ForumApp = () => (
  <Routes>
    {/* Đăng nhập luôn diễn ra ở cổng tin tức. */}
    <Route path="/login" element={<ExternalRedirect origin={portalHref('/login')} keepPath={false} />} />

    <Route path="/" element={<MainLayout />}>
      {/* Gốc tên miền con là trang chủ diễn đàn. */}
      <Route index element={<ForumPage />} />
      <Route path="c/:slug" element={<ForumCategoryPage />} />

      {/* Đường dẫn cũ, giữ để link đã chia sẻ không gãy. */}
      <Route path="forum" element={<Navigate to="/" replace />} />
      <Route path="forum/:slug" element={<LegacyBoxRedirect />} />

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
              href="/"
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
