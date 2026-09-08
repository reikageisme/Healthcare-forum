/**
 * Hai mặt của cùng một hệ thống: trang tin (medicvn.com) và diễn đàn
 * (forums.medicvn.com).
 *
 * Chúng dùng chung tài khoản, chung bảng posts, chung bình luận và chung hàng
 * chờ kiểm duyệt — nhưng nội dung thì không dùng chung. Một cột nhãn quyết
 * định bài nào hiện ở đâu, và đây là chỗ duy nhất định nghĩa hai giá trị hợp
 * lệ, để không ai gõ nhầm 'portals' rồi lặng lẽ mất một nửa bảng tin.
 */
export const SURFACES = ['portal', 'forum'] as const;
export type Surface = (typeof SURFACES)[number];

/** Giá trị hợp lệ thì trả về, còn lại trả null — không đoán, không mặc định. */
export function asSurface(raw: unknown): Surface | null {
  return raw === 'portal' || raw === 'forum' ? raw : null;
}

/**
 * Chỉ toà soạn mới đăng được lên trang tin.
 *
 * "Tin tức là tin tức": một bài trên medicvn.com đứng tên trang, người đọc
 * hiểu đó là nội dung đã qua biên tập. Thành viên thường vẫn viết thoải mái,
 * nhưng bài của họ thuộc về diễn đàn.
 */
export function canPublishToPortal(role: string): boolean {
  return role === 'admin' || role === 'moderator' || role === 'doctor';
}
