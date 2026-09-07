import React from 'react';
import { Link } from 'react-router-dom';
import { isCrossSite } from '../../lib/siteLinks';

/**
 * Liên kết có thể trỏ sang trang kia trong cặp trang tin / diễn đàn.
 *
 * Cùng tên miền thì dùng <Link> của react-router (không tải lại trang); khác
 * tên miền thì bắt buộc là <a> thật, vì react-router không rời được origin
 * hiện tại. Các component dùng chung gọi portalHref/forumHref rồi đưa kết quả
 * vào đây mà không cần biết mình đang chạy ở bản nào.
 */
interface SiteLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string;
}

export const SiteLink: React.FC<SiteLinkProps> = ({ to, children, ...rest }) => {
  if (isCrossSite(to)) {
    return (
      <a href={to} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <Link to={to} {...rest}>
      {children}
    </Link>
  );
};

export default SiteLink;
