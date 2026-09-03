import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle2, FileText, LayoutList, Table2 } from 'lucide-react';
import StoriesCarousel from '../components/Stories/StoriesCarousel';
import CreatePostBox from '../components/Feed/CreatePostBox';
import FeedCard from '../components/Feed/FeedCard';
import CategoryStrip from '../components/Feed/CategoryStrip';
import PostTable from '../components/posts/PostTable';
import { PostCardSkeleton } from '../components/common/LoadingSkeleton';
import { EmptyState } from '../components/common/EmptyState';
import { postService } from '../services/postService';
import { Post } from '../types';

const TABS = [
  { id: 'ALL', label: 'Tất cả', type: undefined },
  { id: 'ARTICLE', label: 'Bài viết', type: 'ARTICLE' },
  { id: 'QUESTION', label: 'Hỏi đáp', type: 'QUESTION' },
  { id: 'REVIEW', label: 'Đánh giá', desc: 'Đánh giá', type: 'REVIEW' },
  { id: 'SHARE', label: 'Chia sẻ', type: 'SHARE' },
];

export const HomePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTypeParam = searchParams.get('type')?.toUpperCase();
  const searchParam = searchParams.get('search') || '';

  const [activeTab, setActiveTab] = useState<string>(activeTypeParam || 'ALL');
  // Chế độ xem được nhớ lại: người đã chọn bảng thì đổi tab vẫn là bảng.
  const [view, setView] = useState<'card' | 'table'>(() => {
    try {
      return localStorage.getItem('feed_view') === 'table' ? 'table' : 'card';
    } catch {
      return 'card';
    }
  });

  const changeView = (next: 'card' | 'table') => {
    setView(next);
    try {
      localStorage.setItem('feed_view', next);
    } catch {
      /* chế độ riêng tư chặn localStorage — không sao, chỉ mất ghi nhớ */
    }
  };
  const [posts, setPosts] = useState<Post[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [isLoadingInitial, setIsLoadingInitial] = useState<boolean>(true);
  const [isFetchingNext, setIsFetchingNext] = useState<boolean>(false);

  const observerTargetRef = useRef<HTMLDivElement | null>(null);

  // Sync tab with url
  useEffect(() => {
    if (activeTypeParam) {
      setActiveTab(activeTypeParam);
    }
  }, [activeTypeParam]);

  const fetchInitialPosts = useCallback(async (type?: string, search?: string) => {
    try {
      setIsLoadingInitial(true);
      const res = await postService.getPosts({
        limit: 10,
        post_type: type && type !== 'ALL' ? type : undefined,
        search: search || undefined,
      });
      setPosts(res.items);
      setNextCursor(res.next_cursor);
      setHasMore(res.has_more);
    } catch (err) {
      console.error('Failed to load posts', err);
    } finally {
      setIsLoadingInitial(false);
    }
  }, []);

  useEffect(() => {
    const type = activeTab === 'ALL' ? undefined : activeTab;
    fetchInitialPosts(type, searchParam);
  }, [activeTab, searchParam, fetchInitialPosts]);

  const loadMorePosts = async () => {
    if (!nextCursor || isFetchingNext || !hasMore) return;

    try {
      setIsFetchingNext(true);
      const type = activeTab === 'ALL' ? undefined : activeTab;
      const res = await postService.getPosts({
        cursor: nextCursor,
        limit: 10,
        post_type: type,
        search: searchParam || undefined,
      });

      setPosts((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const newItems = res.items.filter((p) => !existingIds.has(p.id));
        return [...prev, ...newItems];
      });
      setNextCursor(res.next_cursor);
      setHasMore(res.has_more);
    } catch (err) {
      console.error('Failed to load more posts', err);
    } finally {
      setIsFetchingNext(false);
    }
  };

  // Intersection Observer for Infinite Scroll
  useEffect(() => {
    const target = observerTargetRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isFetchingNext && !isLoadingInitial) {
          loadMorePosts();
        }
      },
      {
        rootMargin: '250px',
      }
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, isFetchingNext, isLoadingInitial, nextCursor]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    if (tabId === 'ALL') {
      searchParams.delete('type');
    } else {
      searchParams.set('type', tabId.toLowerCase());
    }
    setSearchParams(searchParams);
  };

  return (
    <div className="max-w-4xl mx-auto xl:mx-0 xl:max-w-none">
      {/* Top Stories */}
      <StoriesCarousel />

      {/* Create Post Prompt Box */}
      <CreatePostBox />

      {/* Danh mục */}
      <CategoryStrip />

      {/* Feed Filters Tabs + chuyển chế độ xem */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-2 flex-1 min-w-0">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-primary text-white shadow-sm shadow-primary/25'
                    : 'bg-white text-text-secondary hover:text-text hover:bg-slate-100 border border-border'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1 bg-white border border-border rounded-xl p-1 shrink-0">
          <button
            type="button"
            onClick={() => changeView('card')}
            aria-pressed={view === 'card'}
            title="Xem dạng thẻ"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              view === 'card' ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:text-text'
            }`}
          >
            <LayoutList size={15} aria-hidden="true" />
            <span className="hidden sm:inline">Thẻ</span>
          </button>
          <button
            type="button"
            onClick={() => changeView('table')}
            aria-pressed={view === 'table'}
            title="Xem dạng bảng"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              view === 'table' ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:text-text'
            }`}
          >
            <Table2 size={15} aria-hidden="true" />
            <span className="hidden sm:inline">Bảng</span>
          </button>
        </div>
      </div>

      {/* Feed Content List */}
      {isLoadingInitial ? (
        <div className="space-y-4">
          <PostCardSkeleton />
          <PostCardSkeleton />
          <PostCardSkeleton />
        </div>
      ) : posts.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Chưa có bài viết nào"
          description={
            searchParam
              ? `Không tìm thấy bài viết nào phù hợp với từ khóa "${searchParam}".`
              : 'Hãy là người đầu tiên chia sẻ câu hỏi hoặc kiến thức sức khỏe hữu ích cho cộng đồng!'
          }
          actionText="Viết bài ngay"
          actionHref="/create-post"
        />
      ) : view === 'table' ? (
        <PostTable posts={posts} />
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <FeedCard
              key={post.id}
              post={post}
              onDeleted={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))}
            />
          ))}
        </div>
      )}

      {/* Infinite Scroll Sentinel / Loading Spinner */}
      <div ref={observerTargetRef} className="py-6 flex flex-col items-center justify-center">
        {isFetchingNext && (
          <div className="flex items-center gap-2 text-primary text-sm font-medium py-2">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>Đang tải thêm bài viết...</span>
          </div>
        )}

        {!hasMore && !isLoadingInitial && posts.length > 0 && (
          <div className="flex items-center gap-2 text-xs sm:text-sm text-text-secondary bg-slate-100 px-4 py-2 rounded-full mt-2">
            <CheckCircle2 size={16} className="text-emerald-500" />
            <span>Bạn đã xem hết tất cả bài viết 🎉</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;
