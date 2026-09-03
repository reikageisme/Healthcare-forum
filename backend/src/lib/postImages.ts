const IMG_SRC = /<img\b[^>]*?\ssrc=["']([^"']+)["']/gi;

/**
 * Danh sách ảnh của một bài viết, dùng để dựng lưới ảnh kiểu Facebook ở feed.
 *
 * Ảnh vốn đã nằm trong HTML nội dung (trình soạn thảo chèn thẳng thẻ <img>),
 * nên không cần bảng ảnh riêng hay cột mới: chỉ rút src ra theo đúng thứ tự
 * xuất hiện. Thumbnail — nếu có — luôn đứng đầu vì tác giả đã chọn nó làm ảnh
 * đại diện. Ảnh data: URI bị bỏ qua, chúng thường là ảnh dán tạm rất nặng.
 */
export function postImages(
  content: string | null | undefined,
  thumbnail: string | null | undefined,
  limit = 20,
): string[] {
  const out: string[] = [];
  if (thumbnail) out.push(thumbnail);

  for (const match of (content ?? '').matchAll(IMG_SRC)) {
    const src = match[1];
    if (!src || src.startsWith('data:') || out.includes(src)) continue;
    out.push(src);
    if (out.length >= limit) break;
  }
  return out;
}
