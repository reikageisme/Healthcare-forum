import React, { useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { forumCategoryHref } from '../../lib/siteLinks';

/**
 * Chuyển hướng sang tên miền kia, giữ nguyên phần đuôi đường dẫn.
 *
 * Ở production việc này do nginx làm bằng 301 (tốt hơn cho SEO và không tốn
 * một vòng tải JavaScript). Component này là lưới đỡ cho môi trường phát
 * triển, nơi không có nginx đứng trước, và cho những link cũ lọt vào SPA.
 */
export const ExternalRedirect: React.FC<{ origin: string; keepPath?: boolean }> = ({
  origin,
  keepPath = true,
}) => {
  const location = useLocation();

  useEffect(() => {
    const suffix = keepPath ? location.pathname + location.search : '';
    window.location.replace(origin + suffix);
  }, [origin, keepPath, location.pathname, location.search]);

  return (
    <div className="bg-surface rounded-2xl p-12 text-center border border-border shadow-sm max-w-xl mx-auto my-8">
      <p className="text-sm text-text-secondary">Đang chuyển sang {origin}&hellip;</p>
    </div>
  );
};

/**
 * Link cũ dạng /forum/tim-mach ở cổng tin tức.
 *
 * Box của diễn đàn giờ nằm ở /c/:slug trên tên miền con, nên phần đuôi phải
 * được ánh xạ chứ không bê nguyên. Ở production nginx đã trả 301 trước khi
 * tới đây; đây là lưới đỡ cho môi trường phát triển.
 */
export const ForumCategoryRedirect: React.FC = () => {
  const { slug } = useParams();
  const target = slug ? forumCategoryHref(slug) : forumCategoryHref('');

  useEffect(() => {
    window.location.replace(target);
  }, [target]);

  return (
    <div className="bg-surface rounded-2xl p-12 text-center border border-border shadow-sm max-w-xl mx-auto my-8">
      <p className="text-sm text-text-secondary">Đang chuyển sang diễn đàn&hellip;</p>
    </div>
  );
};

export default ExternalRedirect;
