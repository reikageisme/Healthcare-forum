import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bookmark, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import FeedCard from '../components/Feed/FeedCard';
import { PostCardSkeleton } from '../components/common/LoadingSkeleton';
import { EmptyState } from '../components/common/EmptyState';
import { bookmarkService } from '../services/bookmarkService';
import { Post } from '../types';
import { useAuth } from '../hooks/useAuth';

export const BookmarksPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  const [posts, setPosts] = useState<Post[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [isLoadingInitial, setIsLoadingInitial] = useState<boolean>(true);
  const [isFetchingNext, setIsFetchingNext] = useState<boolean>(false);

  const observerTargetRef = useRef<HTMLDivElement | null>(null);

  const fetchBookmarks = useCallback(async () => {
    if (!isAuthenticated) {
      setIsLoadingInitial(false);
      navigate('/login', { state: { from: location } });
      return;
    }

    try {
      setIsLoadingInitial(true);
      const res = await bookmarkService.getBookmarks(null, 10);
      setPosts(res.items);
      setNextCursor(res.next_cursor);
      setHasMore(res.has_more);
    } catch (err) {
      console.error('Failed to load bookmarks', err);
    } finally {
      setIsLoadingInitial(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchBookmarks();
  }, [fetchBookmarks]);

  const loadMoreBookmarks = async () => {
    if (!nextCursor || isFetchingNext || !hasMore) return;

    try {
      setIsFetchingNext(true);
      const res = await bookmarkService.getBookmarks(nextCursor, 10);

      setPosts((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const newItems = res.items.filter((p) => !existingIds.has(p.id));
        return [...prev, ...newItems];
      });
      setNextCursor(res.next_cursor);
      setHasMore(res.has_more);
    } catch (err) {
      console.error('Failed to load more bookmarks', err);
    } finally {
      setIsFetchingNext(false);
    }
  };

  useEffect(() => {
    const target = observerTargetRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isFetchingNext && !isLoadingInitial) {
          loadMoreBookmarks();
        }
      },
      { rootMargin: '250px' }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, isFetchingNext, isLoadingInitial, nextCursor]);

  const handleBookmarkToggle = (postId: string, isBookmarked: boolean) => {
    if (!isBookmarked) {
      // Remove from list
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    }
  };

  return (
    <div className="max-w-3xl mx-auto xl:mx-0 xl:max-w-none">
      {/* Page Header */}
      <div className="bg-surface rounded-2xl p-6 shadow-sm border border-border mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-primary flex items-center justify-center">
            <Bookmark size={24} className="fill-primary text-primary" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-text">Bài viết đã lưu</h1>
            <p className="text-xs sm:text-sm text-text-secondary mt-0.5">
              Danh sách các bài viết, cẩm nang và câu hỏi y khoa bạn đã đánh dấu
            </p>
          </div>
        </div>
      </div>

      {/* Feed Content */}
      {isLoadingInitial ? (
        <div className="space-y-4">
          <PostCardSkeleton />
          <PostCardSkeleton />
        </div>
      ) : !isAuthenticated ? (
        <EmptyState 
          icon={Bookmark}
          title="Vui lòng đăng nhập"
          description="Đăng nhập để xem danh sách các bài viết bạn đã lưu và lưu trữ tài liệu sức khỏe hữu ích."
          actionText="Đăng nhập ngay"
          onAction={() => navigate('/login', { state: { from: location } })}
        />
      ) : posts.length === 0 ? (
        <EmptyState 
          icon={Bookmark}
          title="Chưa có bài viết nào được lưu"
          description="Lưu những bài viết hữu ích để dễ dàng đọc lại bất cứ lúc nào."
          actionText="Khám phá ngay"
          onAction={() => navigate('/')}
        />
      ) : (
        <div className="space-y-4">
          {posts.map(post => (
            <FeedCard 
              key={post.id} 
              post={{ ...post, is_bookmarked: true }} 
              onBookmarkToggle={handleBookmarkToggle}
            />
          ))}
          
          {/* Infinite Scroll Trigger */}
          {hasMore && (
            <div 
              ref={observerTargetRef} 
              className="w-full flex justify-center py-6"
            >
              {isFetchingNext && <Loader2 size={24} className="animate-spin text-primary" />}
            </div>
          )}
          
          {!hasMore && posts.length > 0 && (
            <div className="py-8 text-center text-sm font-medium text-slate-500 bg-white rounded-xl border border-slate-100 mt-6 shadow-sm">
              Bạn đã xem hết bài viết đã lưu.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BookmarksPage;
