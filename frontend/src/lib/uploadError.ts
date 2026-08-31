const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/**
 * Checked before the request goes out, so an oversized or wrong-typed file
 * gets an immediate, specific answer instead of a round trip.
 */
export function validateImageFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return `Định dạng ${file.type || 'không xác định'} không được hỗ trợ. Vui lòng chọn ảnh JPG, PNG, WebP hoặc GIF.`;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return `Ảnh nặng ${mb}MB, vượt giới hạn 5MB. Vui lòng chọn ảnh nhỏ hơn.`;
  }
  if (file.size === 0) {
    return 'Tệp rỗng, không thể tải lên.';
  }
  return null;
}

/**
 * Surfaces what actually went wrong. The previous handler printed the same
 * "format or size" sentence for every failure, so a 413 from the proxy, an
 * expired session and a server error were indistinguishable.
 */
export function describeUploadError(error: unknown): string {
  const err = error as {
    response?: { status?: number; data?: { detail?: unknown } };
    code?: string;
  };
  const status = err?.response?.status;
  const detail = err?.response?.data?.detail;

  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: string };
    if (first?.msg) return first.msg;
  }

  if (status === 413) return 'Ảnh quá lớn so với giới hạn của máy chủ. Vui lòng chọn ảnh dưới 5MB.';
  if (status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại rồi thử lại.';
  if (status === 429) return 'Bạn đang tải lên quá nhanh. Vui lòng đợi một lát rồi thử lại.';
  if (status && status >= 500) return 'Máy chủ gặp sự cố khi xử lý ảnh. Vui lòng thử lại sau.';
  if (err?.code === 'ERR_NETWORK') return 'Không kết nối được máy chủ. Kiểm tra lại mạng rồi thử lại.';

  return 'Không thể tải ảnh lên. Vui lòng thử lại.';
}
