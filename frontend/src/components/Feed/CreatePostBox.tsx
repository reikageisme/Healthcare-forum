import React, { useState } from 'react';
import { PenLine, MessageCircle, Star, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import LoginModal from '../Auth/LoginModal';
import { getAvatarUrl } from '../../lib/utils';

export const CreatePostBox: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const navigate = useNavigate();

  const handleAction = (postType = 'ARTICLE') => {
    if (!isAuthenticated) {
      setShowLogin(true);
      return;
    }
    navigate(`/create-post?type=${postType}`);
  };

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

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </>
  );
};

export default CreatePostBox;
