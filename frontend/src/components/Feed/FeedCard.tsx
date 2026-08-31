import React, { useState } from 'react';
import {
  MessageCircle,
  Share2,
  MoreHorizontal,
  ShieldCheck,
  Clock,
  XCircle,
  Flag,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Post } from '../../types';
import { ReactionButtons } from '../posts/ReactionButtons';
import { BookmarkButton } from '../posts/BookmarkButton';
import { ReportModal } from '../common/ReportModal';
import { formatRelativeTime, getAvatarUrl, getPostTypeInfo } from '../../lib/utils';
import { useAuthStore } from '../../stores/authStore';
import { AnonymousBadge, VerifiedDoctorBadge, isVerifiedDoctor } from '../common/Badges';
import { postService } from '../../services/postService';

interface FeedCardProps {
  post: Post;
  onBookmarkToggle?: (postId: string, isBookmarked: boolean) => void;
  onDeleted?: (postId: string) => void;
}

export const FeedCard: React.FC<FeedCardProps> = ({ post, onBookmarkToggle, onDeleted }) => {
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.user);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const author = post.author;
  // A plain "BS." only means an admin set the role; the blue tick means a
  // practising licence was actually reviewed.
  const isVerified = isVerifiedDoctor(author);
  const isDoctor = author?.role?.toUpperCase() === 'DOCTOR' && !isVerified;
  const typeInfo = getPostTypeInfo(post.post_type || post.type);
  const postUrl = `/posts/${post.id || post.slug}`;
  const statusNorm = post.status?.toLowerCase();

  // Editing was only reachable from the post detail page, so a typo spotted
  // in the feed meant opening the post first. The same permission rule the
  // backend enforces is mirrored here.
  const role = currentUser?.role?.toUpperCase();
  const isAuthor = !!currentUser && !!author && currentUser.id === author.id;
  const canManage = !!currentUser && (isAuthor || role === 'ADMIN' || role === 'MODERATOR');

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowOptionsMenu(false);
    if (!window.confirm(`Xóa bài viết "${post.title}"? Thao tác này không thể hoàn tác.`)) return;

    try {
      setIsDeleting(true);
      await postService.deletePost(post.id);
      onDeleted?.(post.id);
    } catch (error) {
      console.error('Failed to delete post', error);
      window.alert('Không xóa được bài viết. Vui lòng thử lại.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const fullUrl = `${window.location.origin}${postUrl}`;
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(fullUrl);
      alert('Đã sao chép liên kết bài viết vào clipboard!');
    }
  };

  // The excerpt is capped at 200 characters server-side and clamped to three
  // lines here, so a long post simply stopped mid-sentence with nothing to
  // click. The marker is either the server's ellipsis or a length that will
  // not fit three lines.
  const excerptText = post.excerpt ?? '';
  const isExcerptTruncated = excerptText.endsWith('...') || excerptText.length > 150;

  const reactionCounts = post.reaction_breakdown || {
    helpful: post.helpful_count || post.helpfulCount || 0,
    like: 0,
    informative: 0,
    total: post.helpful_count || post.helpfulCount || 0,
  };

  return (
    <>
      <article className="bg-surface rounded-2xl p-5 sm:p-6 shadow-sm border border-border mb-4 hover:border-blue-300 transition-all">
        {/* Author Header */}
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-3">
            <img
              src={getAvatarUrl(author, author?.full_name || author?.fullName || 'Doctor')}
              alt={author?.full_name || author?.fullName || 'Author'}
              className="w-10 h-10 rounded-full object-cover border border-border"
            />
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-sm text-text">
                  {author?.full_name || author?.fullName || author?.username || 'Người dùng'}
                </span>
                {isDoctor && (
                  <span className="flex items-center gap-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold px-1.5 py-0.5 rounded">
                    <ShieldCheck size={11} aria-hidden="true" />
                    BS.
                  </span>
                )}
                <VerifiedDoctorBadge user={author} />
                {post.is_anonymous && <AnonymousBadge isOwn={isAuthor} />}
                {author?.specialty && (
                  <span className="text-xs text-text-secondary hidden sm:inline">
                    • {author.specialty}
                  </span>
                )}
              </div>
              <div className="text-xs text-text-secondary flex items-center gap-2 mt-0.5 flex-wrap">
                <span>{formatRelativeTime(post.created_at || post.createdAt)}</span>
                <span>•</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${typeInfo.bgBadge}`}>
                  {typeInfo.label}
                </span>
                {post.category && (
                  <>
                    <span>•</span>
                    <span className="text-text-secondary font-medium hidden sm:inline">
                      {post.category.name}
                    </span>
                  </>
                )}
                {statusNorm === 'pending' && (
                  <span className="flex items-center gap-1 bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-300">
                    <Clock size={11} className="text-amber-600" />
                    Đang chờ duyệt
                  </span>
                )}
                {statusNorm === 'rejected' && (
                  <span className="flex items-center gap-1 bg-red-100 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-300">
                    <XCircle size={11} className="text-red-600" />
                    Đã từ chối
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowOptionsMenu(!showOptionsMenu)}
              className="text-text-secondary hover:text-text p-1.5 rounded-full hover:bg-slate-100 transition-colors"
              title="Tùy chọn"
            >
              <MoreHorizontal size={18} />
            </button>

            {showOptionsMenu && (
              <div className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-lg border border-border py-1.5 z-20 animate-in fade-in zoom-in-95">
                {canManage && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setShowOptionsMenu(false);
                        navigate(`/posts/${post.id}/edit`);
                      }}
                      className="w-full text-left px-3.5 py-1.5 text-xs text-text hover:bg-slate-50 transition-colors flex items-center gap-2 font-medium"
                    >
                      <Pencil size={14} />
                      <span>Sửa bài viết</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="w-full text-left px-3.5 py-1.5 text-xs text-danger hover:bg-red-50 transition-colors flex items-center gap-2 font-medium disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                      <span>{isDeleting ? 'Đang xóa...' : 'Xóa bài viết'}</span>
                    </button>
                    <div className="my-1 border-t border-border" />
                  </>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowOptionsMenu(false);
                    setShowReportModal(true);
                  }}
                  className="w-full text-left px-3.5 py-1.5 text-xs text-danger hover:bg-red-50 transition-colors flex items-center gap-2 font-medium"
                >
                  <Flag size={14} />
                  <span>Báo cáo bài viết</span>
                </button>
              </div>
            )}
          </div>
        </div>

      {/* Title & Excerpt */}
      <div className="mb-4">
        <Link to={postUrl} className="block group">
          <h2 className="text-lg sm:text-xl font-bold text-text mb-2 group-hover:text-primary transition-colors line-clamp-2">
            {post.title}
          </h2>
          {post.excerpt && (
            <p className="text-sm text-text-secondary line-clamp-3 leading-relaxed">
              {post.excerpt}
            </p>
          )}
        </Link>
        {isExcerptTruncated && (
          <Link
            to={postUrl}
            className="inline-block mt-1.5 text-sm font-semibold text-primary hover:text-primary-dark transition-colors"
          >
            Xem thêm
          </Link>
        )}
      </div>

      {/* Thumbnail */}
      {post.thumbnail && (
        <div
          onClick={() => navigate(postUrl)}
          className="mb-4 rounded-xl overflow-hidden bg-slate-100 border border-border max-h-80 flex items-center justify-center cursor-pointer group"
        >
          <img
            src={post.thumbnail}
            alt={post.title}
            className="w-full object-cover max-h-80 group-hover:scale-102 transition-transform duration-300"
          />
        </div>
      )}

      {/* Tags */}
      {post.tags && post.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {post.tags.map((tag) => (
            <Link
              key={tag.id || tag.slug}
              to={`/tags/${tag.slug}`}
              className="text-xs text-primary bg-primary/5 hover:bg-primary/10 border border-primary/10 px-2.5 py-1 rounded-lg font-medium transition-colors"
            >
              #{tag.name}
            </Link>
          ))}
        </div>
      )}

      {/* Actions Footer */}
      <div className="flex items-center justify-between pt-3.5 border-t border-border flex-wrap gap-2">
        {/* Reactions */}
        <ReactionButtons
          postId={post.id}
          initialCounts={reactionCounts}
          initialUserReaction={post.user_reaction}
          size="sm"
        />

        <div className="flex items-center gap-1">
          {/* Comments link */}
          <Link
            to={`${postUrl}#comments`}
            className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-text-secondary hover:text-primary hover:bg-primary/5 px-2.5 sm:px-3 py-1.5 rounded-lg transition-colors"
          >
            <MessageCircle size={17} />
            <span>{post.comment_count ?? post.commentCount ?? 0}</span>
            <span className="hidden sm:inline">bình luận</span>
          </Link>

          {/* Bookmark Button */}
          <BookmarkButton
            postId={post.id}
            initialIsBookmarked={post.is_bookmarked || false}
            onToggle={(state) => onBookmarkToggle && onBookmarkToggle(post.id, state)}
            size={18}
          />

          {/* Share Button */}
          <button
            type="button"
            onClick={handleShare}
            className="text-text-secondary hover:text-text p-2 rounded-lg hover:bg-slate-100 transition-colors"
            title="Chia sẻ bài viết"
          >
            <Share2 size={18} />
          </button>
        </div>
      </div>
    </article>

    {showReportModal && (
      <ReportModal
        isOpen={showReportModal}
        targetType="post"
        targetId={post.id}
        targetTitle={post.title}
        onClose={() => setShowReportModal(false)}
      />
    )}
  </>
  );
};

export default FeedCard;

