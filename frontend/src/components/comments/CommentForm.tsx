import React, { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate, useLocation } from 'react-router-dom';
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
  const navigate = useNavigate();
  const location = useLocation();
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      navigate('/login', { state: { from: location } });
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
      navigate('/login', { state: { from: location } });
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className={cn('flex items-start gap-3 w-full', className)}>
        <img
          src={getAvatarUrl(user, user?.full_name || 'Guest')}
          alt="User Avatar"
          className="w-8 h-8 rounded-full object-cover border border-border mt-1 flex-shrink-0"
        />
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onFocus={handleFocus}
            placeholder={placeholder}
            autoFocus={autoFocus}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none min-h-[80px]"
          />
          <div className="flex items-center justify-end gap-2">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-3 py-1.5 text-xs font-semibold text-text-secondary hover:text-text hover:bg-slate-100 rounded-lg transition-colors"
              >
                Hủy
              </button>
            )}
            <button
              type="submit"
              disabled={!content.trim() || isSubmitting}
              className="flex items-center gap-1.5 bg-primary text-white px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              <span>{submitLabel}</span>
            </button>
          </div>
        </div>
      </form>
      
    </>
  );
};

export default CommentForm;
