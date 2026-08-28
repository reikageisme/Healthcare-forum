import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Folder, Loader2, CheckCircle2, FileText } from 'lucide-react';
import FeedCard from '../components/Feed/FeedCard';
import { PostCardSkeleton } from '../components/common/LoadingSkeleton';
import { EmptyState } from '../components/common/EmptyState';
import { postService } from '../services/postService';
import { categoryService } from '../services/categoryService';
import { Post, Category } from '../types';

export const CategoryPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();

  const [category, setCategory] = useState<Category | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [isLoadingInitial, setIsLoadingInitial] = useState<boolean>(true);
  const [isFetchingNext, setIsFetchingNext] = useState<boolean>(false);

  const observerTargetRef = useRef<HTMLDivElement | null>(null);

  const fetchCategoryData = useCallback(async () => {
    if (!slug) return;

    try {
      setIsLoadingInitial(true);
      const [catData, postsRes] = await Promise.all([
        categoryService.getCategory(slug).catch(() => null),
        postService.getPosts({ category: slug, limit: 10 }),
      ]);

      setCategory(catData);
      setPosts(postsRes.items);
      setNextCursor(postsRes.next_cursor);
      setHasMore(postsRes.has_more);
    } catch (err) {
      console.error('Failed to load category feed', err);
    } finally {
      setIsLoadingInitial(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchCategoryData();
  }, [fetchCategoryData]);

  const loadMorePosts = async () => {
    if (!slug || !nextCursor || isFetchingNext || !hasMore) return;

    try {
      setIsFetchingNext(true);
      const res = await postService.getPosts({
        category: slug,
        cursor: nextCursor,
        limit: 10,
      });

      setPosts((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const newItems = res.items.filter((p) => !existingIds.has(p.id));
        return [...prev, ...newItems];
      });
      setNextCursor(res.next_cursor);
      setHasMore(res.has_more);
    } catch (err) {
      console.error('Failed to load more posts for category', err);
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
          loadMorePosts();
        }
      },
      { rootMargin: '250px' }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, isFetchingNext, isLoadingInitial, nextCursor]);

  return (
    <div className="max-w-3xl mx-auto xl:mx-0 xl:max-w-none">
      {/* Category Header Banner */}
      <div className="bg-surface rounded-2xl p-6 shadow-sm border border-border mb-6">
        <div className="flex items-center gap-2 text-xs text-text-secondary mb-3">
          <Link to="/" className="hover:text-primary transition-colors">
            Trang chủ
          </Link>
          <span>/</span>
          <span>Chuyên mục</span>
        </div>

        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-primary flex items-center justify-center font-bold text-2xl">
            {category?.icon || <Folder size={24} />}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-text">
              {category?.name || slug}
            </h1>
            <p className="text-xs sm:text-sm text-text-secondary mt-0.5">
              {category?.description || `${posts.length} bài viết trong chuyên mục này`}
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
      ) : posts.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Chưa có bài viết nào trong chuyên mục này"
          description={`Chưa có bài viết nào được đăng trong chuyên mục ${category?.name || slug}. Hãy là người đầu tiên!`}
          actionText="Đăng bài trong chuyên mục này"
          actionHref="/create-post"
        />
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <FeedCard key={post.id} post={post} />
          ))}
        </div>
      )}

      {/* Infinite Scroll Sentinel */}
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
            <span>Đã xem hết tất cả bài viết của chuyên mục này 🎉</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoryPage;
