import { IS_FORUM, forumHref } from './siteLinks';
import type { User } from '../types';

/**
 * Ai đăng được bài ở trang đang đứng.
 *
 * Diễn đàn: ai đăng nhập cũng viết được — đó là điểm của một diễn đàn.
 *
 * Trang tin: chỉ ban biên tập (admin, kiểm duyệt viên, bác sĩ đã có tài
 * khoản). Một bài trên medicvn.com đứng tên trang, người đọc hiểu đó là nội
 * dung đã qua biên tập; để ai cũng đăng được thì "tin tức" và "diễn đàn" lại
 * thành một thứ. Backend chặn cùng luật này, đây chỉ là để không mời người
 * dùng vào một cái form rồi báo lỗi ở bước cuối.
 */
export function canPostHere(user: { role?: string } | User | null | undefined): boolean {
  if (!user) return false;
  if (IS_FORUM) return true;
  const role = user.role?.toLowerCase();
  return role === 'admin' || role === 'moderator' || role === 'doctor';
}

/** Nơi để gửi người không đăng được bài ở đây: diễn đàn, nơi họ viết được. */
export const writeElsewhereHref = () => forumHref('/create-post');
