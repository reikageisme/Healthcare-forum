import React, { useEffect, useState } from 'react';
import { ExternalLink, Globe } from 'lucide-react';
import { networkService, NetworkInfo } from '../../services/forumService';

/**
 * Thẻ "Mạng lưới" ở sidebar: các trang anh em cùng hệ thống.
 *
 * Danh sách đến từ cấu hình NETWORK_SITES của backend, nên mọi trang trong
 * mạng lưới dùng chung một cấu hình và trang đang mở tự nhận ra chính mình
 * (so với SITE_URL) thay vì phải cắt tên mình ra khỏi danh sách.
 *
 * Chưa cấu hình gì thì cả thẻ biến mất — không ai muốn một ô trống ghi
 * "chưa có liên kết nào".
 */
export const NetworkCard: React.FC = () => {
  const [network, setNetwork] = useState<NetworkInfo | null>(null);

  useEffect(() => {
    networkService
      .getNetwork()
      .then(setNetwork)
      .catch((err) => console.error('Failed to load network sites', err));
  }, []);

  if (!network || network.sites.length === 0) return null;

  return (
    <nav
      aria-label={network.name || 'Mạng lưới'}
      className="bg-surface rounded-2xl p-5 shadow-sm border border-border"
    >
      <h3 className="font-bold text-text mb-1.5 flex items-center gap-2">
        <Globe size={17} className="text-primary" aria-hidden="true" />
        {network.name || 'Mạng lưới'}
      </h3>
      {network.tagline && (
        <p className="text-xs text-text-secondary leading-relaxed mb-3.5">{network.tagline}</p>
      )}

      <ul className="flex flex-col gap-2">
        {network.sites.map((site) =>
          site.is_current ? (
            <li key={site.url}>
              <div
                aria-current="page"
                className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border-2 border-primary bg-primary/5"
              >
                <span className="text-sm font-bold text-primary truncate">{site.name}</span>
                <span className="text-[10px] font-bold uppercase tracking-wide text-primary whitespace-nowrap">
                  Đang xem
                </span>
              </div>
            </li>
          ) : (
            <li key={site.url}>
              <a
                href={site.url}
                target="_blank"
                rel="noopener noreferrer"
                title={site.description || site.name}
                className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-transparent hover:border-primary/30 hover:bg-primary/5 transition-colors group"
              >
                <span className="text-sm font-semibold text-text-secondary group-hover:text-primary truncate transition-colors">
                  {site.name}
                </span>
                <ExternalLink
                  size={14}
                  className="text-slate-400 group-hover:text-primary shrink-0 transition-colors"
                  aria-hidden="true"
                />
                <span className="sr-only">(mở tab mới)</span>
              </a>
            </li>
          ),
        )}
      </ul>
    </nav>
  );
};

export default NetworkCard;
