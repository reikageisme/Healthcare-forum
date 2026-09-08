import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { X, Loader2, Eye, Calendar, ExternalLink } from 'lucide-react';
import { postService } from '../../services/postService';
import { Post } from '../../types';
import { CommentTree } from '../comments/CommentTree';
import { ReactionButtons } from './ReactionButtons';
import { BookmarkButton } from './BookmarkButton';
import { AnonymousBadge, VerifiedDoctorBadge } from '../common/Badges';
import { formatRelativeTime, getAvatarUrl, getPostTypeInfo } from '../../lib/utils';

interface PostModalProps {
  postId: string;
  /** Có sẵn từ thẻ trong feed thì hiện ngay, không phải chờ mạng. */
  preview?: Post;
  onClose: () => void;
}

/**
 * Mở một bài ngay tại chỗ đang lướt, kiểu Facebook.
 *
 * Trước đây bấm "bình luận" là rời trang: mất vị trí cuộn, mất cả danh sách
 * vừa tải, và quay lại thì phải tải lại từ đầu. Popup giữ nguyên trang nền —
 * đóng lại là về đúng chỗ vừa đứng.
 *
 * Đây KHÔNG thay cho trang /posts/:id. Người vào từ Google hay từ link chia
 * sẻ vẫn cần một trang thật, có địa chỉ riêng và đọc được bằng máy; nút "Mở
 * trang riêng" ở góc là lối sang đó.
 */
export const PostModal: React.FC<PostModalProps> = ({ postId, preview, onClose }) => {
  const [post, setPost] = useState<Post | null>(preview ?? null);
  const [isLoading, setIsLoading] = useState(!preview?.content);

  // Thẻ ở feed chỉ có excerpt, không có nội dung đầy đủ — vẫn phải gọi một
  // lần, nhưng người dùng đã thấy tiêu đề và ảnh ngay từ khung đầu tiên.
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const data = await postService.getPostById(postId);
        if (alive) setPost(data);
      } catch (err) {
        console.error('Failed to load post', err);
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [postId]);

  /**
   * Esc để đóng, và khoá cuộn của trang nền.
   *
   * Không khoá thì cuộn trong popup tới đáy là trang phía sau cuộn tiếp —
   * đóng popup ra thấy mình ở một chỗ hoàn toàn khác.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const author = post?.author;
  const typeInfo = getPostTypeInfo(post?.post_type || post?.type);
  const postUrl = post ? `/posts/${post.id || post.slug}` : '#';

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/60 p-0 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-surface w-full sm:max-w-[680px] h-full sm:h-auto sm:max-h-[90vh] sm:rounded-xl shadow-2xl flex flex-col overflow-hidden"
        // Bấm bên trong không được đóng popup.
        onClick={(e) => e.stopPropagation()}
      >
        {/* Thanh tiêu đề dính đỉnh */}
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border shrink-0">
          <h2 className="text-[15px] font-bold text-text truncate">
            {post ? post.title : 'Đang tải...'}
          </h2>
          <div className="flex items-center gap-1 shrink-0">
            <Link
              to={postUrl}
              className="p-1.5 rounded-full text-text-secondary hover:bg-slate-100 hover:text-primary transition-colors"
              title="Mở trang riêng của bài"
            >
              <ExternalLink size={16} />
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full text-text-secondary hover:bg-slate-100 hover:text-text transition-colors"
              title="Đóng"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Thân cuộn được: bài ở trên, thảo luận ở dưới, liền một mạch */}
        <div className="flex-1 overflow-y-auto px-4 py-3.5">
          {!post ? (
            <div className="py-16 flex justify-center text-text-secondary">
              <Loader2 className="animate-spin" size={24} />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2.5 mb-3">
                <img
                  src={getAvatarUrl(author, author?.full_name || author?.username || 'User')}
                  alt=""
                  className="w-9 h-9 rounded-full object-cover border border-border"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[13px] font-bold text-text truncate">
                      {author?.full_name || author?.username || 'Người dùng'}
                    </span>
                    <VerifiedDoctorBadge user={author} />
                    {post.is_anonymous && <AnonymousBadge />}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-text-secondary mt-0.5">
                    <span className={`px-1.5 py-0.5 rounded font-bold border ${typeInfo.bgBadge}`}>
                      {typeInfo.label}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar size={11} />
                      {formatRelativeTime(post.created_at || post.createdAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye size={11} />
                      {post.view_count || 0}
                    </span>
                  </div>
                </div>
              </div>

              <h1 className="text-lg font-extrabold text-text leading-snug mb-2.5">{post.title}</h1>

              {post.thumbnail && (
                <img
                  src={post.thumbnail}
                  alt=""
                  className="w-full rounded-lg border border-border mb-3 max-h-[420px] object-cover"
                />
              )}

              {isLoading && !post.content ? (
                <div className="py-6 flex justify-center text-text-secondary">
                  <Loader2 className="animate-spin" size={20} />
                </div>
              ) : (
                <div
                  className="prose prose-sm prose-blue max-w-none text-text leading-relaxed prose-img:rounded-lg prose-img:border prose-img:border-border"
                  dangerouslySetInnerHTML={{ __html: post.content || `<p>${post.excerpt ?? ''}</p>` }}
                />
              )}

              <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-2 flex-wrap">
                <ReactionButtons
                  postId={post.id}
                  initialCounts={post.reaction_breakdown}
                  initialUserReaction={post.user_reaction}
                  size="sm"
                />
                <BookmarkButton postId={post.id} initialIsBookmarked={post.is_bookmarked || false} size={17} />
              </div>

              <div className="mt-4 pt-4 border-t border-border">
                <CommentTree
                  embedded
                  postId={post.id}
                  totalComments={post.comment_count || post.commentCount || 0}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PostModal;
