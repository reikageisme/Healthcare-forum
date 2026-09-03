import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Building2,
  CalendarDays,
  ChevronRight,
  FileText,
  Loader2,
  MessageCircle,
  Pencil,
  Stethoscope,
} from 'lucide-react';
import { userService } from '../services/userService';
import { postService } from '../services/postService';
import { Post, User } from '../types';
import { useAuth } from '../hooks/useAuth';
import { formatDate, getAvatarUrl } from '../lib/utils';
import { VerifiedDoctorBadge, isVerifiedDoctor } from '../components/common/Badges';
import { PostCardSkeleton } from '../components/common/LoadingSkeleton';
import { EmptyState } from '../components/common/EmptyState';
import PostTable from '../components/posts/PostTable';

/**
 * Hồ sơ công khai của một thành viên.
 *
 * Bài ẩn danh không xuất hiện ở đây — kể cả với chính chủ. Người ta chọn ẩn
 * danh để không ai nối được bài với tên mình; nếu hồ sơ liệt kê ra thì cái
 * nút ẩn danh chỉ còn là trang trí.
 */

const PAGE_SIZE = 20;

export const ProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user: me } = useAuth();

  const [user, setUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setNotFound(false);
      const [profile, page] = await Promise.all([
        userService.getUser(id),
        postService.getPosts({ author_id: id, limit: PAGE_SIZE }),
      ]);
      setUser(profile);
      setPosts(page.items);
      setCursor(page.next_cursor);
      setHasMore(page.has_more);
    } catch (err) {
      console.error('Failed to load profile', err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = async () => {
    if (!id || !cursor || loadingMore || !hasMore) return;
    try {
      setLoadingMore(true);
      const page = await postService.getPosts({ author_id: id, cursor, limit: PAGE_SIZE });
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...page.items.filter((p) => !seen.has(p.id))];
      });
      setCursor(page.next_cursor);
      setHasMore(page.has_more);
    } catch (err) {
      console.error('Failed to load more posts', err);
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) return <PostCardSkeleton />;

  if (notFound || !user) {
    return (
      <EmptyState
        title="Không tìm thấy thành viên"
        description="Hồ sơ này không tồn tại hoặc tài khoản đã bị vô hiệu hóa."
        actionText="Về trang chủ"
        actionHref="/"
      />
    );
  }

  const isMe = me?.id === user.id;
  const displayName = user.full_name || user.username;

  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-text-secondary mb-3">
        <Link to="/" className="hover:text-primary">Trang chủ</Link>
        <ChevronRight size={12} aria-hidden="true" />
        <span className="text-text font-medium">{displayName}</span>
      </div>

      <section className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden mb-4">
        <div
          className="h-28 sm:h-36 bg-gradient-to-r from-primary via-primary-light to-accent"
          aria-hidden="true"
        />

        <div className="px-5 sm:px-7 pb-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <img
              src={getAvatarUrl(user, displayName)}
              alt={displayName}
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover border-4 border-white shadow-lg -mt-12 sm:-mt-14 bg-white"
            />
            {isMe && (
              <Link
                to="/settings/profile"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-full text-sm font-semibold shadow-sm transition-colors"
              >
                <Pencil size={15} aria-hidden="true" />
                Chỉnh sửa hồ sơ
              </Link>
            )}
          </div>

          <div className="mt-3">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-extrabold text-text tracking-tight">{displayName}</h1>
              <VerifiedDoctorBadge user={user} />
              {!isVerifiedDoctor(user) && user.role?.toUpperCase() === 'DOCTOR' && (
                <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                  <Stethoscope size={11} aria-hidden="true" />
                  BS.
                </span>
              )}
            </div>
            <p className="text-[13px] text-text-secondary mt-0.5">@{user.username}</p>

            {user.bio && (
              <p className="text-sm text-text-secondary leading-relaxed mt-3 max-w-2xl whitespace-pre-line">
                {user.bio}
              </p>
            )}

            <div className="flex flex-wrap gap-x-5 gap-y-2 mt-3 text-xs text-text-secondary">
              {user.specialty && (
                <span className="inline-flex items-center gap-1.5">
                  <Stethoscope size={14} className="text-slate-400" aria-hidden="true" />
                  {user.specialty}
                </span>
              )}
              {user.workplace && (
                <span className="inline-flex items-center gap-1.5">
                  <Building2 size={14} className="text-slate-400" aria-hidden="true" />
                  {user.workplace}
                </span>
              )}
              {user.created_at && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays size={14} className="text-slate-400" aria-hidden="true" />
                  Tham gia {formatDate(user.created_at)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 border-t border-border">
          <div className="px-5 py-3.5 text-center border-r border-slate-100">
            <span className="block text-xl font-extrabold text-text tabular-nums">
              {(user.post_count ?? 0).toLocaleString('vi-VN')}
            </span>
            <span className="text-[11px] font-semibold text-text-secondary">Bài viết</span>
          </div>
          <div className="px-5 py-3.5 text-center">
            <span className="block text-xl font-extrabold text-text tabular-nums">
              {(user.comment_count ?? 0).toLocaleString('vi-VN')}
            </span>
            <span className="text-[11px] font-semibold text-text-secondary">Bình luận</span>
          </div>
        </div>
      </section>

      <h2 className="text-sm font-bold text-text mb-3 flex items-center gap-2">
        <FileText size={16} className="text-primary" aria-hidden="true" />
        Bài viết của {displayName}
      </h2>

      {posts.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title="Chưa có bài viết công khai"
          description={
            isMe
              ? 'Bài bạn đăng ẩn danh sẽ không hiện ở đây — đó là chủ ý, để không ai nối được bài với tên bạn.'
              : 'Thành viên này chưa đăng bài công khai nào.'
          }
        />
      ) : (
        <>
          <PostTable posts={posts} />
          {hasMore && (
            <div className="flex justify-center mt-4">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-border rounded-full text-sm font-semibold text-text-secondary hover:text-primary hover:border-primary/40 transition-colors disabled:opacity-60"
              >
                {loadingMore && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
                {loadingMore ? 'Đang tải...' : 'Tải thêm'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ProfilePage;
