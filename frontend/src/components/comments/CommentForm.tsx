import React, { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import LoginModal from '../Auth/LoginModal';
import { cn, getAvatarUrl } from '../../lib/utils';

interface CommentFormProps {
  onSubmit: (content: string) => Promise<void>;
  placeholder?: string;
  autoFocus?: boolean;
  onCancel?: () => void;
  submitLabel?: string;
  className?: string;
}

export const CommentForm: React.FC<CommentFormProps> = ({
  onSubmit,
  placeholder = 'Chia sẻ ý kiến hoặc câu hỏi của bạn...',
  autoFocus = false,
  onCancel,
  submitLabel = 'Gửi bình luận',
  className,
}) => {
  const { isAuthenticated, user } = useAuth();
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }

    if (!content.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await onSubmit(content.trim());
      setContent('');
    } catch (error) {
      console.error('Failed to submit comment', error);
      alert('Không thể gửi bình luận. Vui lòng thử lại sau.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFocus = () => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className={cn('flex flex-col gap-3', className)}>
        <div className="flex gap-3">
          <img
            src={getAvatarUrl(user, user?.full_name || 'Guest')}
            alt="User avatar"
            className="w-9 h-9 rounded-full object-cover border border-border flex-shrink-0"
          />
          <div className="flex-1 relative">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onFocus={handleFocus}
              autoFocus={autoFocus}
              rows={3}
              placeholder={placeholder}
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-slate-50 focus:bg-white text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-3.5 py-1.5 text-sm text-text-secondary hover:text-text hover:bg-slate-100 rounded-lg transition-colors font-medium"
            >
              Hủy
            </button>
          )}
          <button
            type="submit"
            disabled={!content.trim() || isSubmitting}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-primary hover:bg-primary-dark text-white rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Đang gửi...</span>
              </>
            ) : (
              <>
                <Send size={16} />
                <span>{submitLabel}</span>
              </>
            )}
          </button>
        </div>
      </form>

      {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}
    </>
  );
};

export default CommentForm;
