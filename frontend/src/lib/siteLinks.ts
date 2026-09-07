/**
 * Cặp trang tin / diễn đàn.
 *
 * Từ chặng tách tên miền, một mã nguồn dựng ra hai bản: bản "portal" chạy ở
 * medicvn.com và bản "forum" chạy ở forum.medicvn.com. Cùng components, cùng
 * bảng màu, chỉ khác tập route và vài liên kết trỏ sang trang kia.
 *
 * Chọn bản nào là do biến VITE_APP lúc build quyết định, không phải lúc chạy —
 * mỗi container chỉ chứa đúng một bản.
 */

export type AppKind = 'portal' | 'forum';

export const APP_KIND: AppKind = import.meta.env.VITE_APP === 'forum' ? 'forum' : 'portal';
export const IS_FORUM = APP_KIND === 'forum';
export const IS_PORTAL = !IS_FORUM;

/** Bỏ dấu / cuối để nối chuỗi không sinh ra "//". */
const trim = (value: string) => value.replace(/\/+$/, '');

const PORTAL_ORIGIN = trim(import.meta.env.VITE_PORTAL_URL || '');
const FORUM_ORIGIN = trim(import.meta.env.VITE_FORUM_URL || '');

/**
 * Đường dẫn gốc của diễn đàn.
 *
 * Cố ý giữ nguyên "/forum" ở cả hai bản: mọi liên kết cũ trong FeedCard,
 * CategoryStrip, ForumPage... vẫn đúng, và nginx của trang tin chỉ việc
 * chuyển hướng 301 nguyên si phần đuôi sang tên miền con.
 */
export const FORUM_BASE = '/forum';

/**
 * Địa chỉ tới một trang trên cổng tin tức.
 *
 * Đang ở chính trang tin, hoặc chưa cấu hình tên miền (chạy dev một app), thì
 * trả về đường dẫn tương đối để react-router xử lý nội bộ — không tải lại trang.
 */
export function portalHref(path = '/'): string {
  if (IS_PORTAL || !PORTAL_ORIGIN) return path;
  return PORTAL_ORIGIN + path;
}

/** Địa chỉ tới một trang trên diễn đàn. */
export function forumHref(path: string = FORUM_BASE): string {
  if (IS_FORUM || !FORUM_ORIGIN) return path;
  return FORUM_ORIGIN + path;
}

/** Địa chỉ này có rời khỏi tên miền hiện tại không. */
export function isCrossSite(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

/**
 * Trang đăng nhập nằm ở cổng tin tức — nó là máy chủ danh tính, diễn đàn
 * không giữ mật khẩu. `next` để quay lại đúng chỗ đang đứng sau khi đăng nhập.
 */
export function loginHref(next?: string): string {
  const target = next ?? (typeof window !== 'undefined' ? window.location.href : '/');
  const base = portalHref('/login');
  if (IS_PORTAL && !isCrossSite(base)) {
    // Cùng tên miền: react-router tự nhớ vị trí cũ qua location.state.
    return base;
  }
  return `${base}?next=${encodeURIComponent(target)}`;
}

/**
 * Chỉ chấp nhận quay về hai tên miền của chính mình.
 *
 * Không có hàm này thì `?next=https://trang-lua-dao` biến trang đăng nhập
 * thành một open redirect: kẻ gửi link dẫn người dùng qua đúng medicvn.com
 * rồi hất sang chỗ khác ngay sau khi họ nhập mật khẩu.
 */
export function safeNext(raw: string | null): string | null {
  if (!raw) return null;
  // Đường dẫn tương đối luôn an toàn; "//host" thì không, nó là một origin khác.
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw;

  try {
    const url = new URL(raw);
    const allowed = [PORTAL_ORIGIN, FORUM_ORIGIN, window.location.origin].filter(Boolean);
    if (allowed.some((origin) => url.origin === new URL(origin).origin)) return url.toString();
  } catch {
    /* không phải URL hợp lệ */
  }
  return null;
}
