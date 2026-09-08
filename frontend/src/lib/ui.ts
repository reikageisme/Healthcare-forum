/**
 * Thông báo và hộp thoại xác nhận của riêng trang.
 *
 * alert() và confirm() của trình duyệt khoá cả tab, không đóng được bằng
 * phím, không mang màu sắc gì của trang, và trên Chrome còn hiện kèm ô "chặn
 * trang này tạo thêm hộp thoại" — người dùng tick vào là mọi xác nhận về sau
 * im lặng trả về false, tức là nút Xoá bỗng dưng không làm gì cả.
 *
 * Cố ý KHÔNG làm bằng React context: gọi được từ mọi nơi, kể cả trong một
 * hàm bất đồng bộ nằm ngoài component, mà không phải luồn provider qua mười
 * sáu file. Một cửa hàng nhỏ với vài người nghe là đủ.
 */

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Hành động không hoàn tác được thì nút xác nhận màu đỏ. */
  danger?: boolean;
}

type ToastListener = (items: ToastItem[]) => void;

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<ToastListener>();

const emit = () => listeners.forEach((fn) => fn(items));

export function subscribeToasts(fn: ToastListener): () => void {
  listeners.add(fn);
  fn(items);
  return () => {
    listeners.delete(fn);
  };
}

export function dismissToast(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

function push(kind: ToastKind, message: string) {
  const id = nextId++;
  items = [...items, { id, kind, message }];
  emit();
  // Lỗi ở lâu hơn: người ta cần đọc kỹ hơn một dòng "đã lưu".
  window.setTimeout(() => dismissToast(id), kind === 'error' ? 6000 : 3500);
}

export const toast = {
  success: (message: string) => push('success', message),
  error: (message: string) => push('error', message),
  info: (message: string) => push('info', message),
};

/**
 * Hộp thoại xác nhận. Trả về Promise<boolean> nên chỗ gọi đọc y như
 * window.confirm, chỉ thêm một chữ await.
 */
type ConfirmRunner = (options: ConfirmOptions) => Promise<boolean>;

let runConfirm: ConfirmRunner | null = null;

export function setConfirmRunner(fn: ConfirmRunner | null) {
  runConfirm = fn;
}

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  // Overlay chưa gắn (test, render phía máy chủ) thì đừng chặn hành động lại
  // một cách im lặng — rơi về hộp thoại của trình duyệt.
  if (!runConfirm) return Promise.resolve(window.confirm(options.message));
  return runConfirm(options);
}
