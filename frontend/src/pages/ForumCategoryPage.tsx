import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ChevronRight,
  CheckCircle2,
  Clock,
  EyeOff,
  Loader2,
  MessageCircle,
  Plus,
} from 'lucide-react';
import { postService } from '../services/postService';
import { categoryService } from '../services/categoryService';
import { Post, Category } from '../types';
import { PostCardSkeleton } from '../components/common/LoadingSkeleton';
import { EmptyState } from '../components/common/EmptyState';
import { formatRelativeTime, getAvatarUrl, getPostTypeInfo } from '../lib/utils';
import { isVerifiedDoctor } from '../components/common/Badges';

/**
 * Danh sách chủ đề của một box — cùng dữ liệu với trang chuyên mục, chỉ đổi
 * cách trình bày: mỗi bài là một dòng có số trả lời và số lượt xem thay vì
 * một thẻ feed cao ba trăm pixel. Ba mươi thớt đọc hết trong một màn hình,
 * đó là toàn bộ lý do người ta vào diễn đàn thay vì lướt bảng tin.
 */

const PAGE_SIZE = 20;

const ThreadRow: React.FC<{ post: Post }> = ({ post }) => {
  const author = post.author;
  const typeInfo = getPostTypeInfo(post.post_type || post.type);
  const solved = !!post.accepted_comment_id;

  return (
    <div className="grid grid-cols-[36px_1fr] sm:grid-cols-[36px_1fr_64px_72px] gap-3.5 items-center px-4 sm:px-5 py-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60 transition-colors">
      <img
        src={getAvatarUrl(author, author?.full_name || author?.username || 'Người dùng')}
        alt={author?.full_name || author?.username || 'Người dùng'}
        className="w-9 h-9 rounded-full object-cover border border-border"
      />

      <div className="min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {solved && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
              <CheckCircle2 size={10} />
              Đã giải đáp
            </span>
          )}
          {post.is_anonymous && (
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
              <EyeOff size={10} />
              Ẩn danh
            </span>
          )}
          {post.status?.toLowerCase() === 'pending' && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
              <Clock size={10} />
              Chờ duyệt
            </span>
          )}
          <span className={`text-[11px] font-bold ${typeInfo.color}`}>[{typeInfo.label}]</span>
          <Link
            to={`/posts/${post.id}`}
            className="text-sm font-semibold text-text hover:text-primary transition-colors line-clamp-1"
          >
            {post.title}
          </Link>
        </div>
        <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
          <span>{author?.full_name || author?.username || 'Ẩn danh'}</span>
          {isVerifiedDoctor(author) && <span className="text-primary font-semibold">· BS. đã xác thực</span>}
          <span>·</span>
          <span>{formatRelativeTime(post.created_at || post.createdAt)}</span>
        </div>
      </div>

      <div className="hidden sm:block text-center">
        <span className="block text-[13px] font-bold text-text">
          {(post.comment_count ?? post.commentCount ?? 0).toLocaleString('vi-VN')}
        </span>
        <span className="text-[10px] font-semibold text-slate-400">trả lời</span>
      </div>
      <div className="hidden sm:block text-center">
        <span className="block text-[13px] font-bold text-text">
          {(post.view_count ?? 0).toLocaleString('vi-VN')}
        </span>
        <span className="text-[10px] font-semibold text-slate-400">lượt xem</span>
      </div>
    </div>
  );
};

export const ForumCategoryPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();

  const [category, setCategory] = useState<Category | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [postType, setPostType] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!slug) return;
    try {
      setLoading(true);
      const [cat, page] = await Promise.all([
        categoryService.getCategory(slug).catch(() => null),
        postService.getPosts({
          category: slug,
          limit: PAGE_SIZE,
          ...(postType ? { post_type: postType } : {}),
        }),
      ]);
      setCategory(cat);
      setPosts(page.items);
      setCursor(page.next_cursor);
      setHasMore(page.has_more);
    } catch (err) {
      console.error('Failed to load forum category', err);
    } finally {
      setLoading(false);
    }
  }, [slug, postType]);

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = async () => {
    if (!slug || !cursor || loadingMore || !hasMore) return;
    try {
      setLoadingMore(true);
      const page = await postService.getPosts({
        category: slug,
        cursor,
        limit: PAGE_SIZE,
        ...(postType ? { post_type: postType } : {}),
      });
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...page.items.filter((p) => !seen.has(p.id))];
      });
      setCursor(page.next_cursor);
      setHasMore(page.has_more);
    } catch (err) {
      console.error('Failed to load more threads', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const filters: { label: string; value: string | null }[] = [
    { label: 'Tất cả', value: null },
    { label: 'Hỏi đáp', value: 'question' },
    { label: 'Bài viết', value: 'article' },
    { label: 'Đánh giá', value: 'review' },
    { label: 'Chia sẻ', value: 'share' },
  ];

  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-text-secondary mb-3">
        <Link to="/" className="hover:text-primary">Trang chủ</Link>
        <ChevronRight size={12} />
        <Link to="/forum" className="hover:text-primary">Diễn đàn</Link>
        <ChevronRight size={12} />
        <span className="text-text font-medium">{category?.name || slug}</span>
      </div>

      <div className="bg-surface rounded-2xl border border-border shadow-sm p-5 mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-[22px] font-extrabold text-text tracking-tight">
            {category?.name || 'Chuyên mục'}
          </h1>
          {category?.description && (
            <p className="text-[13px] text-text-secondary mt-1 max-w-2xl">{category.description}</p>
          )}
          {typeof category?.post_count === 'number' && (
            <p className="text-xs text-text-secondary mt-2">
              <b className="text-text">{category.post_count.toLocaleString('vi-VN')}</b> chủ đề
            </p>
          )}
        </div>
        <Link
          to="/create-post"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-full text-sm font-semibold shadow-sm transition-colors shrink-0"
        >
          <Plus size={16} />
          Đăng chủ đề
        </Link>
      </div>

      <div className="bg-surface rounded-2xl border border-border shadow-sm px-4 py-2.5 mb-4 flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.label}
            type="button"
            onClick={() => setPostType(f.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              postType === f.value
                ? 'bg-primary/10 text-primary border-primary/25'
                : 'bg-white text-text-secondary border-border hover:text-primary'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <PostCardSkeleton />
      ) : posts.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title="Chuyên mục này chưa có chủ đề nào"
          description="Hãy là người mở chủ đề đầu tiên — câu hỏi của bạn có thể là điều nhiều người khác đang tìm."
          actionText="Đăng chủ đề"
          actionHref="/create-post"
        />
      ) : (
        <>
          <section className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden mb-4">
            {posts.map((post) => (
              <ThreadRow key={post.id} post={post} />
            ))}
          </section>

          {hasMore && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-border rounded-full text-sm font-semibold text-text-secondary hover:text-primary hover:border-primary/40 transition-colors disabled:opacity-60"
              >
                {loadingMore && <Loader2 size={15} className="animate-spin" />}
                {loadingMore ? 'Đang tải...' : 'Tải thêm chủ đề'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ForumCategoryPage;
