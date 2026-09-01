/**
 * Biến lỗi từ API thành một chuỗi đọc được.
 *
 * Backend trả `detail` theo hai hình dạng: chuỗi cho lỗi thường, và mảng
 * [{loc, msg, type}] cho lỗi kiểm tra dữ liệu (422) — giữ nguyên hình dạng
 * của Pydantic để client cũ không vỡ. Nhét thẳng `detail` vào state rồi
 * render là chỗ chết người: React ném "Objects are not valid as a React
 * child" khi gặp mảng object, và cả trang trắng — đúng cái đã xảy ra ở màn
 * đăng ký khi mật khẩu dưới 8 ký tự.
 */
export function describeApiError(error: unknown, fallback: string): string {
  const err = error as {
    response?: { status?: number; data?: { detail?: unknown } };
    code?: string;
    message?: string;
  };
  const detail = err?.response?.data?.detail;

  if (typeof detail === 'string' && detail.trim()) return detail;

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => (item && typeof item === 'object' ? (item as { msg?: string }).msg : String(item)))
      .filter((m): m is string => typeof m === 'string' && m.trim().length > 0);
    if (messages.length > 0) return messages.join('. ');
  }

  if (detail && typeof detail === 'object') {
    const msg = (detail as { msg?: string }).msg;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }

  if (err?.code === 'ERR_NETWORK') return 'Không kết nối được máy chủ. Kiểm tra lại mạng rồi thử lại.';
  return fallback;
}
