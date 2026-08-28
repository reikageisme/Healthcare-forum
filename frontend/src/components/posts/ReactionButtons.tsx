import React, { useState } from 'react';
import { Lightbulb, Heart, Info, Loader2 } from 'lucide-react';
import { reactionService } from '../../services/reactionService';
import { useAuth } from '../../hooks/useAuth';
import { ReactionCounts } from '../../types';
import LoginModal from '../Auth/LoginModal';
import { cn } from '../../lib/utils';

interface ReactionButtonsProps {
  postId: string;
  initialCounts?: ReactionCounts;
  initialUserReaction?: string | null;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const ReactionButtons: React.FC<ReactionButtonsProps> = ({
  postId,
  initialCounts = { helpful: 0, like: 0, informative: 0, total: 0 },
  initialUserReaction = null,
  className,
  size = 'md',
}) => {
  const { isAuthenticated } = useAuth();
  const [counts, setCounts] = useState<ReactionCounts>(initialCounts);
  const [userReaction, setUserReaction] = useState<string | null>(
    initialUserReaction ? initialUserReaction.toLowerCase() : null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const handleReact = async (type: 'helpful' | 'like' | 'informative') => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }

    if (isLoading) return;

    // Optimistic UI Update
    const prevCounts = { ...counts };
    const prevReaction = userReaction;

    const newCounts = { ...counts };
    let nextReaction: string | null = type;

    if (userReaction === type) {
      // Toggle off
      nextReaction = null;
      newCounts[type] = Math.max(0, newCounts[type] - 1);
      newCounts.total = Math.max(0, newCounts.total - 1);
    } else {
      // Switching or adding
      if (userReaction) {
        const oldType = userReaction as 'helpful' | 'like' | 'informative';
        newCounts[oldType] = Math.max(0, newCounts[oldType] - 1);
      } else {
        newCounts.total += 1;
      }
      newCounts[type] = (newCounts[type] || 0) + 1;
    }

    setCounts(newCounts);
    setUserReaction(nextReaction);

    try {
      setIsLoading(true);
      const res = await reactionService.toggleReaction(postId, type);
      setCounts(res.counts);
      setUserReaction(res.current_reaction ? res.current_reaction.toLowerCase() : null);
    } catch (error) {
      // Revert optimistic update
      console.error('Reaction toggle failed', error);
      setCounts(prevCounts);
      setUserReaction(prevReaction);
    } finally {
      setIsLoading(false);
    }
  };

  const isSm = size === 'sm';
  const iconSize = isSm ? 16 : 18;

  return (
    <>
      <div className={cn('flex items-center gap-1.5 sm:gap-2 flex-wrap', className)}>
        {/* Helpful Reaction */}
        <button
          type="button"
          onClick={() => handleReact('helpful')}
          className={cn(
            'flex items-center gap-1.5 font-medium rounded-lg transition-all border',
            isSm ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
            userReaction === 'helpful'
              ? 'bg-amber-50 text-amber-700 border-amber-300 shadow-sm font-semibold'
              : 'bg-white text-text-secondary border-border hover:border-amber-300 hover:text-amber-600 hover:bg-amber-50/50'
          )}
          title="Đánh giá bài viết hữu ích"
        >
          <Lightbulb
            size={iconSize}
            className={cn(
              userReaction === 'helpful' ? 'fill-amber-400 text-amber-500' : 'text-slate-400'
            )}
          />
          <span>{counts.helpful}</span>
          <span className="hidden md:inline">Hữu ích</span>
        </button>

        {/* Like Reaction */}
        <button
          type="button"
          onClick={() => handleReact('like')}
          className={cn(
            'flex items-center gap-1.5 font-medium rounded-lg transition-all border',
            isSm ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
            userReaction === 'like'
              ? 'bg-rose-50 text-rose-700 border-rose-300 shadow-sm font-semibold'
              : 'bg-white text-text-secondary border-border hover:border-rose-300 hover:text-rose-600 hover:bg-rose-50/50'
          )}
          title="Yêu thích bài viết"
        >
          <Heart
            size={iconSize}
            className={cn(
              userReaction === 'like' ? 'fill-rose-500 text-rose-500' : 'text-slate-400'
            )}
          />
          <span>{counts.like}</span>
          <span className="hidden md:inline">Thích</span>
        </button>

        {/* Informative Reaction */}
        <button
          type="button"
          onClick={() => handleReact('informative')}
          className={cn(
            'flex items-center gap-1.5 font-medium rounded-lg transition-all border',
            isSm ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
            userReaction === 'informative'
              ? 'bg-blue-50 text-primary-dark border-blue-300 shadow-sm font-semibold'
              : 'bg-white text-text-secondary border-border hover:border-blue-300 hover:text-primary hover:bg-blue-50/50'
          )}
          title="Nội dung giàu thông tin"
        >
          <Info
            size={iconSize}
            className={cn(
              userReaction === 'informative' ? 'fill-blue-400 text-blue-600' : 'text-slate-400'
            )}
          />
          <span>{counts.informative}</span>
          <span className="hidden md:inline">Thông tin</span>
        </button>
      </div>

      {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}
    </>
  );
};

export default ReactionButtons;
