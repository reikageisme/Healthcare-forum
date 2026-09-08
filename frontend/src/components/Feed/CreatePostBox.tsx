import React from 'react';
import { PenLine, MessageCircle, Star, MessagesSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useRequireLogin } from '../../hooks/useRequireLogin';
import { canPostHere, writeElsewhereHref } from '../../lib/canPost';
import { IS_FORUM } from '../../lib/siteLinks';
import { getAvatarUrl } from '../../lib/utils';

export const CreatePostBox: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const requireLogin = useRequireLogin();

  const handleAction = (postType = 'ARTICLE') => {
    if (!isAuthenticated) {
      requireLogin();
      return;
    }
    navigate(`/create-post?type=${postType}`);
  };

  /**
   * Ở cổng tin tức, thành viên thường không đăng bài được — nội dung ở đây
   * đứng tên toà soạn. Thay vì giấu ô soạn bài đi (rồi họ không biết đăng ở
   * đâu), chỉ thẳng sang diễn đàn, nơi họ viết được ngay.
   */
  if (!IS_FORUM && !canPostHere(user)) {
    return (
      <a
        href={writeElsewhereHref()}
        className="flex items-center gap-3 bg-surface rounded-lg p-3.5 border border-border mb-4 hover:border-primary/40 transition-colors group"
      >
        <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <MessagesSquare size={18} />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-text group-hover:text-primary transition-colors">
            Bạn có câu hỏi hoặc kinh nghiệm sức khỏe muốn chia sẻ?
          </p>
          <p className="text-[12px] text-text-secondary mt-0.5">
            Đăng bài trên diễn đàn để cộng đồng và bác sĩ cùng trả lời.
          </p>
        </div>
      </a>
    );
  }

  return (
    <>
      <div className="bg-surface rounded-2xl p-4 sm:p-5 shadow-sm border border-border mb-6">
        <div className="flex items-center gap-3 mb-4">
          <img
            src={getAvatarUrl(user, user?.full_name || 'Guest')}
            alt="User Avatar"
            className="w-10 h-10 rounded-full object-cover border border-border flex-shrink-0"
          />
          <button
            type="button"
            onClick={() => handleAction('QUESTION')}
            className="flex-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-blue-300 text-left px-4 py-2.5 rounded-full text-text-secondary text-sm transition-all"
          >
            Bạn có câu hỏi hoặc kinh nghiệm sức khỏe muốn chia sẻ?
          </button>
        </div>

        <div className="grid grid-cols-3 sm:flex sm:justify-between items-center pt-3 border-t border-border gap-1">
          <button
            type="button"
            onClick={() => handleAction('ARTICLE')}
            className="flex items-center justify-center sm:justify-start gap-2 text-xs sm:text-sm font-medium text-text-secondary hover:text-primary px-3 py-2 rounded-xl hover:bg-primary/5 transition-colors"
          >
            <PenLine size={18} className="text-blue-500" />
            <span>Viết bài</span>
          </button>
          <button
            type="button"
            onClick={() => handleAction('QUESTION')}
            className="flex items-center justify-center sm:justify-start gap-2 text-xs sm:text-sm font-medium text-text-secondary hover:text-primary px-3 py-2 rounded-xl hover:bg-primary/5 transition-colors"
          >
            <MessageCircle size={18} className="text-primary" />
            <span>Hỏi đáp</span>
          </button>
          <button
            type="button"
            onClick={() => handleAction('REVIEW')}
            className="flex items-center justify-center sm:justify-start gap-2 text-xs sm:text-sm font-medium text-text-secondary hover:text-primary px-3 py-2 rounded-xl hover:bg-primary/5 transition-colors"
          >
            <Star size={18} className="text-amber-500" />
            <span>Đánh giá</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default CreatePostBox;
