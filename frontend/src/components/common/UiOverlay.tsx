import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Info, X, AlertTriangle } from 'lucide-react';
import {
  ConfirmOptions,
  ToastItem,
  dismissToast,
  setConfirmRunner,
  subscribeToasts,
} from '../../lib/ui';

/**
 * Nơi duy nhất vẽ thông báo và hộp thoại xác nhận cho cả trang.
 *
 * Gắn một lần ở App. Mọi chỗ khác chỉ việc gọi toast.success(...) hoặc
 * await confirmDialog(...) — không cần biết component này tồn tại.
 */

const TONE: Record<ToastItem['kind'], { icon: React.ElementType; className: string }> = {
  success: { icon: CheckCircle2, className: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
  error: { icon: XCircle, className: 'bg-red-50 border-red-200 text-red-800' },
  info: { icon: Info, className: 'bg-white border-border text-text' },
};

const Toasts: React.FC = () => {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => subscribeToasts(setItems), []);

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 w-[min(360px,calc(100vw-2rem))]">
      {items.map((item) => {
        const tone = TONE[item.kind];
        const Icon = tone.icon;
        return (
          <div
            key={item.id}
            role="status"
            className={`flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg border shadow-lg text-[13px] font-medium animate-in slide-in-from-bottom-2 fade-in duration-200 ${tone.className}`}
          >
            <Icon size={16} className="shrink-0 mt-0.5" />
            <span className="flex-1 leading-5">{item.message}</span>
            <button
              type="button"
              onClick={() => dismissToast(item.id)}
              className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"
              aria-label="Đóng thông báo"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
};

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

const ConfirmHost: React.FC = () => {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  useEffect(() => {
    setConfirmRunner(
      (options) => new Promise<boolean>((resolve) => setPending({ ...options, resolve })),
    );
    return () => setConfirmRunner(null);
  }, []);

  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        pending.resolve(false);
        setPending(null);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [pending]);

  if (!pending) return null;

  const answer = (value: boolean) => {
    pending.resolve(value);
    setPending(null);
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-150"
      onClick={() => answer(false)}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-xl shadow-2xl border border-border w-full max-w-sm p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
              pending.danger ? 'bg-red-50 text-danger' : 'bg-primary/10 text-primary'
            }`}
          >
            <AlertTriangle size={18} />
          </div>
          <div className="min-w-0">
            <h3 className="text-[15px] font-bold text-text mb-1">
              {pending.title ?? 'Xác nhận'}
            </h3>
            <p className="text-[13px] text-text-secondary leading-relaxed whitespace-pre-line">
              {pending.message}
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => answer(false)}
            className="px-3.5 py-1.5 rounded-lg text-[13px] font-semibold text-text-secondary hover:bg-slate-100 transition-colors"
          >
            {pending.cancelLabel ?? 'Hủy'}
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => answer(true)}
            className={`px-3.5 py-1.5 rounded-lg text-[13px] font-semibold text-white transition-colors ${
              pending.danger ? 'bg-danger hover:bg-red-600' : 'bg-primary hover:bg-primary-dark'
            }`}
          >
            {pending.confirmLabel ?? 'Đồng ý'}
          </button>
        </div>
      </div>
    </div>
  );
};

export const UiOverlay: React.FC = () => (
  <>
    <Toasts />
    <ConfirmHost />
  </>
);

export default UiOverlay;
