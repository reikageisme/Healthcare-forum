/**
 * Cặp trang tin / diễn đàn.
 *
 * Từ chặng tách tên miền, một mã nguồn dựng ra hai bản: bản "portal" chạy ở
 * medicvn.com và bản "forum" chạy ở forums.medicvn.com. Cùng components, cùng
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
 * Địa chỉ mặc định khi thiếu biến môi trường.
 *
 * Docker compose luôn truyền VITE_PORTAL_URL và VITE_FORUM_URL vào lúc dựng,
 * nên hai giá trị này chỉ dùng khi ai đó chạy `npm run dev` trần. Thà trỏ về
 * cổng dev tương ứng còn hơn sinh ra một liên kết tương đối dẫn về chính
 * trang đang đứng — kiểu lỗi đó im lặng và rất khó nhận ra.
 */
const DEV_PORTAL_ORIGIN = 'http://localhost:3000';
const DEV_FORUM_ORIGIN = 'http://localhost:4000';

/**
 * Địa chỉ tới một trang trên cổng tin tức.
 *
 * Đang ở chính trang tin thì trả về đường dẫn tương đối để react-router xử lý
 * nội bộ — không tải lại trang.
 */
export function portalHref(path = '/'): string {
  if (IS_PORTAL) return path;
  return (PORTAL_ORIGIN || DEV_PORTAL_ORIGIN) + path;
}

/**
 * Địa chỉ tới một trang trên diễn đàn.
 *
 * Trang chủ diễn đàn nằm ở gốc tên miền con: forums.medicvn.com/ chứ không
 * phải forums.medicvn.com/forum — lặp lại chữ "forum" trong địa chỉ của chính
 * trang diễn đàn thì thừa.
 */
export function forumHref(path = '/'): string {
  if (IS_FORUM) return path;
  return (FORUM_ORIGIN || DEV_FORUM_ORIGIN) + path;
}

/**
 * Địa chỉ một box của diễn đàn.
 *
 * Tách thành hàm riêng vì tiền tố "/c/" xuất hiện ở bảy chỗ trong các
 * component dùng chung — Footer, PostTable, CategoryStrip, SidebarLeft,
 * ForumPage... Đổi cách đặt đường dẫn về sau thì sửa đúng một nơi.
 */
export function forumCategoryHref(slug: string): string {
  return forumHref(`/c/${slug}`);
}

/** Địa chỉ một thớt trên diễn đàn. */
export function forumThreadHref(id: string): string {
  return forumHref(`/posts/${id}`);
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
