import React, { useState } from 'react';
import { Bookmark } from 'lucide-react';
import { bookmarkService } from '../../services/bookmarkService';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '../../lib/utils';

interface BookmarkButtonProps {
  postId: string;
  initialIsBookmarked?: boolean;
  onToggle?: (isBookmarked: boolean) => void;
  className?: string;
  size?: number;
  showLabel?: boolean;
}

export const BookmarkButton: React.FC<BookmarkButtonProps> = ({
  postId,
  initialIsBookmarked = false,
  onToggle,
  className,
  size = 20,
  showLabel = false,
}) => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isBookmarked, setIsBookmarked] = useState(initialIsBookmarked);
  const [isLoading, setIsLoading] = useState(false);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (!isAuthenticated) {
      navigate('/login', { state: { from: location } });
      return;
    }

    if (isLoading) return;

    const previousState = isBookmarked;
    const nextState = !previousState;
    setIsBookmarked(nextState);
    if (onToggle) onToggle(nextState);

    try {
      setIsLoading(true);
      const res = await bookmarkService.toggleBookmark(postId);
      setIsBookmarked(res.is_bookmarked);
      if (onToggle) onToggle(res.is_bookmarked);
    } catch (error) {
      console.error('Failed to toggle bookmark', error);
      setIsBookmarked(previousState);
      if (onToggle) onToggle(previousState);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          'p-2 rounded-lg transition-colors flex items-center gap-1.5',
          isBookmarked
            ? 'text-primary bg-primary/10 hover:bg-primary/20 font-semibold'
            : 'text-text-secondary hover:text-primary hover:bg-slate-100',
          className
        )}
        title={isBookmarked ? 'Bỏ lưu bài viết' : 'Lưu bài viết'}
      >
        <Bookmark
          size={size}
          className={cn(
            'transition-transform active:scale-125',
            isBookmarked ? 'fill-primary text-primary' : 'text-current'
          )}
        />
        {showLabel && (
          <span className="text-sm">{isBookmarked ? 'Đã lưu' : 'Lưu bài'}</span>
        )}
      </button>
    </>
  );
};

export default BookmarkButton;
