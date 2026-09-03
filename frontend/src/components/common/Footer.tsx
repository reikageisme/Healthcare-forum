import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { HeartPulse, Mail, ShieldAlert } from 'lucide-react';
import { networkService, NetworkInfo } from '../../services/forumService';
import { categoryService } from '../../services/categoryService';
import { Category } from '../../types';
import { rootsOf } from '../../lib/categoryTree';
import SiteAvatar from './SiteAvatar';

/**
 * Chân trang.
 *
 * Trước đây bản quyền nằm lọt trong sidebar phải — cột đó chỉ hiện từ 1280px
 * trở lên, nên trên laptop nhỏ và điện thoại trang không có chân trang nào cả.
 *
 * Cột chuyên khoa lấy thẳng từ cây chuyên mục thật thay vì danh sách viết tay,
 * để không lặp lại chuyện "Cơ sở y tế" trỏ tới thẻ không tồn tại. Liên kết
 * pháp lý đến từ cấu hình FOOTER_LINKS: chưa có trang thì mục đó không hiện,
 * chứ không dựng liên kết dẫn tới trang trắng.
 */

const EXPLORE = [
  { label: 'Trang chủ', to: '/' },
  { label: 'Diễn đàn', to: '/forum' },
  { label: 'Hỏi đáp', to: '/?type=question' },
  { label: 'Bài viết', to: '/?type=article' },
  { label: 'Đánh giá', to: '/?type=review' },
  { label: 'Bài đã lưu', to: '/bookmarks' },
];

const isExternal = (url: string) => /^https?:\/\//i.test(url);

export const Footer: React.FC = () => {
  const [network, setNetwork] = useState<NetworkInfo | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    networkService.getNetwork().then(setNetwork).catch(() => setNetwork(null));
    categoryService.getCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  const topCategories = rootsOf(categories).slice(0, 6);
  const legal = network?.footer_links ?? [];
  const email = network?.contact_email ?? '';
  const year = new Date().getFullYear();

  return (
    <footer className="mt-10 border-t border-border bg-surface">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          {/* Thương hiệu */}
          <div>
            <Link to="/" className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center shadow-md shadow-primary/25">
                <HeartPulse className="w-5 h-5" aria-hidden="true" />
              </div>
              <span className="font-extrabold text-xl text-primary tracking-tight">SứcKhỏeVN</span>
            </Link>
            <p className="text-sm text-text-secondary leading-relaxed max-w-sm">
              Cổng thông tin y tế cộng đồng — nơi người bệnh đặt câu hỏi và bác sĩ đã xác thực
              trả lời công khai, để câu trả lời còn giúp được người sau.
            </p>
            {network?.name && network.sites.length > 0 && (
              <p className="text-xs text-text-secondary mt-3">
                Thuộc <span className="font-semibold text-text">{network.name}</span>
              </p>
            )}
          </div>

          {/* Khám phá */}
          <nav aria-labelledby="footer-explore">
            <h2
              id="footer-explore"
              className="text-[11px] font-bold uppercase tracking-wider text-text-secondary mb-4"
            >
              Khám phá
            </h2>
            <ul className="flex flex-col gap-2.5">
              {EXPLORE.map((item) => (
                <li key={item.label}>
                  <Link
                    to={item.to}
                    className="text-sm text-text-secondary hover:text-primary transition-colors"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Chuyên khoa */}
          {topCategories.length > 0 && (
            <nav aria-labelledby="footer-categories">
              <h2
                id="footer-categories"
                className="text-[11px] font-bold uppercase tracking-wider text-text-secondary mb-4"
              >
                Chuyên khoa
              </h2>
              <ul className="flex flex-col gap-2.5">
                {topCategories.map((cat) => (
                  <li key={cat.id}>
                    <Link
                      to={`/forum/${cat.slug}`}
                      className="text-sm text-text-secondary hover:text-primary transition-colors line-clamp-1"
                    >
                      {cat.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          {/* Kết nối */}
          {(email || (network?.sites.length ?? 0) > 0) && (
            <nav aria-labelledby="footer-connect">
              <h2
                id="footer-connect"
                className="text-[11px] font-bold uppercase tracking-wider text-text-secondary mb-4"
              >
                Kết nối
              </h2>
              <ul className="flex flex-col gap-2.5">
                {email && (
                  <li>
                    <a
                      href={`mailto:${email}`}
                      className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-primary transition-colors"
                    >
                      <Mail size={14} aria-hidden="true" />
                      Liên hệ
                    </a>
                  </li>
                )}
                {network?.sites
                  .filter((site) => !site.is_current)
                  .map((site) => (
                    <li key={site.url}>
                      <a
                        href={site.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-primary transition-colors"
                      >
                        <SiteAvatar name={site.name} url={site.url} iconUrl={site.icon_url} size={18} />
                        {site.name}
                        <span className="sr-only"> (mở tab mới)</span>
                      </a>
                    </li>
                  ))}
              </ul>
            </nav>
          )}
        </div>

        {/* Miễn trừ trách nhiệm y tế — thứ duy nhất trong chân trang này thật sự quan trọng */}
        <div className="flex gap-3 mt-10 p-4 rounded-xl bg-amber-50 border border-amber-200">
          <ShieldAlert size={18} className="text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-xs text-amber-800 leading-relaxed">
            <b>Miễn trừ trách nhiệm y tế.</b> Mọi nội dung trên SứcKhỏeVN chỉ mang tính tham khảo
            và không thay thế chẩn đoán, điều trị của bác sĩ. Đừng tự ý dùng thuốc hay ngưng thuốc
            dựa trên một bài viết. Trường hợp cấp cứu — đau ngực dữ dội, khó thở, yếu nửa người,
            ngất — hãy gọi <b>115</b> ngay thay vì đăng bài.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-8 pt-6 border-t border-border">
          <p className="text-xs text-text-secondary">
            © {year} SứcKhỏeVN. Giữ toàn bộ bản quyền.
          </p>
          <span className="flex-1" />
          {legal.map((link) =>
            isExternal(link.url) ? (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-text-secondary hover:text-primary transition-colors"
              >
                {link.name}
              </a>
            ) : (
              <Link
                key={link.url}
                to={link.url}
                className="text-xs text-text-secondary hover:text-primary transition-colors"
              >
                {link.name}
              </Link>
            ),
          )}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
