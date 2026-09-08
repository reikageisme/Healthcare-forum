import React, { useState } from 'react';
import { Send, Loader2, EyeOff, LogIn } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useRequireLogin } from '../../hooks/useRequireLogin';
import { useAuthStore } from '../../stores/authStore';
import { cn, getAvatarUrl } from '../../lib/utils';

interface CommentFormProps {
  onSubmit: (content: string, isAnonymous: boolean) => Promise<void>;
  placeholder?: string;
  autoFocus?: boolean;
  onCancel?: () => void;
  submitLabel?: string;
  className?: string;
}

/**
 * Ô trả lời của diễn đàn.
 *
 * Hai thay đổi so với bản trước, cùng vì một lý do là nó phải cư xử như một
 * diễn đàn chứ không phải một cái form:
 *
 * 1. Không còn đá người chưa đăng nhập sang /login ngay khi họ bấm vào ô. Một
 *    cú chạm nhầm cũng đủ mất trang, và Back thì lại rơi vào đúng ô đó để bị
 *    đá tiếp. Khách nhìn thấy một thanh mời đăng nhập, bấm mới đi.
 * 2. Thu về một dòng, chỉ nở ra khi được bấm vào. Một khung 80px luôn mở
 *    chiếm mất phần màn hình đáng ra để đọc bài.
 */
export const CommentForm: React.FC<CommentFormProps> = ({
  onSubmit,
  placeholder = 'Viết trả lời...',
  autoFocus = false,
  onCancel,
  submitLabel = 'Gửi',
  className,
}) => {
  const { isAuthenticated, user } = useAuth();
  const authReady = useAuthStore((s) => s.authReady);
  const requireLogin = useRequireLogin();
  const [content, setContent] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpen, setIsOpen] = useState(autoFocus);
  const [error, setError] = useState<string | null>(null);

  // "Chưa đăng nhập" chỉ chắc chắn sau khi phiên từ cookie đã được hỏi xong.
  const isGuest = authReady && !isAuthenticated;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      requireLogin();
      return;
    }
    if (!content.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      setError(null);
      await onSubmit(content.trim(), isAnonymous);
      setContent('');
      setIsAnonymous(false);
      if (!autoFocus) setIsOpen(false);
    } catch (err) {
      console.error('Failed to submit comment', err);
      setError('Không gửi được trả lời. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isGuest) {
    return (
      <button
        type="button"
        onClick={() => requireLogin()}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border',
          'bg-slate-50 text-[13px] text-text-secondary hover:border-primary hover:text-primary transition-colors',
          className,
        )}
      >
        <LogIn size={15} />
        <span>Đăng nhập để tham gia thảo luận</span>
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={cn('flex items-start gap-2 w-full', className)}>
      <img
        src={getAvatarUrl(user, user?.full_name || 'Guest')}
        alt=""
        className="w-7 h-7 rounded-full object-cover border border-border mt-0.5 flex-shrink-0"
      />
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          rows={isOpen ? 3 : 1}
          className={cn(
            'w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[13px] leading-5',
            'focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary',
            'transition-all resize-y',
            isOpen ? 'min-h-[72px]' : 'min-h-[36px] overflow-hidden',
          )}
        />

        {error && <p className="text-[12px] text-danger">{error}</p>}

        {isOpen && (
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <label className="flex items-center gap-1.5 text-[12px] text-text-secondary cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="rounded border-slate-300 text-primary focus:ring-primary/40 w-3.5 h-3.5"
              />
              <EyeOff size={13} />
              Đăng ẩn danh
            </label>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setContent('');
                  setIsOpen(false);
                  if (onCancel) onCancel();
                }}
                className="px-2.5 py-1 text-[12px] font-medium text-text-secondary hover:text-text hover:bg-slate-100 rounded-md transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={!content.trim() || isSubmitting}
                className="flex items-center gap-1.5 bg-primary text-white px-3 py-1 rounded-md text-[12px] font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                <span>{submitLabel}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </form>
  );
};

export default CommentForm;
