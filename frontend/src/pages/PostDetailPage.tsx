import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Eye,
  Calendar,
  Share2,
  Edit,
  Trash2,
  ArrowLeft,
  ShieldCheck,
  Tag as TagIcon,
  Folder,
  AlertCircle,
  Clock,
  Flag,
} from 'lucide-react';
import { postService } from '../services/postService';
import { Post } from '../types';
import { ReactionButtons } from '../components/posts/ReactionButtons';
import { BookmarkButton } from '../components/posts/BookmarkButton';
import { CommentTree } from '../components/comments/CommentTree';
import { ReportModal } from '../components/common/ReportModal';
import { PostDetailSkeleton } from '../components/common/LoadingSkeleton';
import { useAuth } from '../hooks/useAuth';
import { formatRelativeTime, formatDate, getAvatarUrl, getPostTypeInfo } from '../lib/utils';

export const PostDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [post, setPost] = useState<Post | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchPost = async () => {
      try {
        setIsLoading(true);
        const data = await postService.getPostById(id);
        setPost(data);
      } catch (err: any) {
        console.error('Failed to load post detail', err);
        setErrorMsg('Không tìm thấy bài viết hoặc bài viết đã bị xóa.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPost();
  }, [id]);

  const handleDeletePost = async () => {
    if (!post) return;
    if (window.confirm('Bạn có chắc chắn muốn xóa bài viết này không? Hành động này không thể hoàn tác.')) {
      try {
        await postService.deletePost(post.id);
        alert('Đã xóa bài viết thành công!');
        navigate('/');
      } catch (err) {
        console.error('Failed to delete post', err);
        alert('Không thể xóa bài viết. Vui lòng thử lại sau.');
      }
    }
  };

  const handleShare = async () => {
    const fullUrl = window.location.href;
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(fullUrl);
      alert('Đã sao chép liên kết bài viết vào clipboard!');
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-2">
        <PostDetailSkeleton />
      </div>
    );
  }

  if (!post || errorMsg) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center bg-white rounded-2xl p-8 border border-border shadow-sm">
        <p className="text-danger font-bold text-lg mb-3">{errorMsg || 'Không tìm thấy bài viết.'}</p>
        <p className="text-text-secondary text-sm mb-6">Bài viết có thể đã bị xóa hoặc không tồn tại.</p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary-dark transition-colors"
        >
          <ArrowLeft size={16} /> Quay lại trang chủ
        </Link>
      </div>
    );
  }

  const author = post.author;
  const isDoctor = author?.role?.toUpperCase() === 'DOCTOR';
  const isAuthor = user && author && user.id === author.id;
  const canManage = user && (isAuthor || user.role?.toUpperCase() === 'ADMIN' || user.role?.toUpperCase() === 'MODERATOR');
  const typeInfo = getPostTypeInfo(post.post_type || post.type);
  const statusNorm = post.status?.toLowerCase();

  return (
    <div className="max-w-4xl mx-auto py-2">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-primary transition-colors bg-white px-3.5 py-2 rounded-xl border border-border"
        >
          <ArrowLeft size={18} />
          <span>Quay lại</span>
        </button>

        <div className="flex items-center gap-2 text-xs sm:text-sm text-text-secondary">
          <Link to="/" className="hover:text-primary transition-colors">Trang chủ</Link>
          <span>/</span>
          {post.category ? (
            <Link to={`/category/${post.category.slug}`} className="hover:text-primary transition-colors font-medium">
              {post.category.name}
            </Link>
          ) : (
            <span>Bài viết</span>
          )}
        </div>
      </div>

      {/* Main Post Card */}
      <article className="bg-surface rounded-2xl p-6 sm:p-8 shadow-sm border border-border mb-6">
        {/* Pending & Rejected Notification Banners */}
        {statusNorm === 'pending' && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-amber-900">Bài viết đang chờ phê duyệt</h4>
              <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                Bài viết của bạn đang trong hàng chờ kiểm duyệt và chỉ hiển thị với bạn.
                Bác sĩ hoặc Quản trị viên sẽ xem xét nội dung trong thời gian sớm nhất trước khi phát hành công khai.
              </p>
            </div>
          </div>
        )}
        {statusNorm === 'rejected' && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-red-900">Bài viết đã bị từ chối phê duyệt</h4>
              <p className="text-xs text-red-700 mt-0.5 leading-relaxed">
                {post.rejection_reason
                  ? `Lý do từ chối: "${post.rejection_reason}"`
                  : 'Nội dung chưa đáp ứng tiêu chuẩn cộng đồng hoặc quy định y tế.'}
              </p>
            </div>
          </div>
        )}

        {/* Post Metadata & Category chips */}
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4 pb-4 border-b border-border">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${typeInfo.bgBadge}`}>
              {typeInfo.label}
            </span>
            {post.category && (
              <span className="flex items-center gap-1 text-xs font-semibold text-text-secondary bg-slate-100 px-3 py-1 rounded-full">
                <Folder size={12} className="text-slate-400" />
                {post.category.name}
              </span>
            )}
            {statusNorm === 'pending' && (
              <span className="flex items-center gap-1 bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-0.5 rounded-full border border-amber-300">
                <Clock size={12} className="text-amber-600" />
                Đang chờ duyệt
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-text-secondary">
            <span className="flex items-center gap-1">
              <Eye size={14} />
              {post.view_count || 0} lượt xem
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Calendar size={14} />
              {formatDate(post.created_at || post.createdAt)}
            </span>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-text leading-tight mb-6">
          {post.title}
        </h1>

        {/* Author Card */}
        <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 mb-6 flex-wrap">
          <div className="flex items-center gap-3.5">
            <img
              src={getAvatarUrl(author, author?.full_name || author?.username || 'Doctor')}
              alt={author?.full_name || 'Author'}
              className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm"
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-base text-text">
                  {author?.full_name || author?.username || 'Người dùng'}
                </span>
                {isDoctor && (
                  <span className="flex items-center gap-1 bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-md">
                    <ShieldCheck size={13} />
                    Bác sĩ
                  </span>
                )}
              </div>
              <div className="text-xs text-text-secondary mt-0.5">
                {author?.specialty ? `Chuyên khoa ${author.specialty}` : `@${author?.username || 'user'}`}
                {author?.bio && ` • ${author.bio}`}
              </div>
            </div>
          </div>

          {/* Author/Admin Actions */}
          {canManage && (
            <div className="flex items-center gap-2">
              <Link
                to={`/posts/${post.id}/edit`}
                className="flex items-center gap-1 px-3 py-1.5 bg-white border border-border hover:border-primary text-text-secondary hover:text-primary rounded-lg text-xs font-semibold transition-colors shadow-sm"
              >
                <Edit size={14} /> Sửa bài
              </Link>
              <button
                type="button"
                onClick={handleDeletePost}
                className="flex items-center gap-1 px-3 py-1.5 bg-white border border-border hover:border-danger text-text-secondary hover:text-danger rounded-lg text-xs font-semibold transition-colors shadow-sm"
              >
                <Trash2 size={14} /> Xóa
              </button>
            </div>
          )}
        </div>

        {/* Featured Thumbnail */}
        {post.thumbnail && (
          <div className="mb-8 rounded-2xl overflow-hidden bg-slate-100 border border-border max-h-[460px] flex items-center justify-center">
            <img
              src={post.thumbnail}
              alt={post.title}
              className="w-full object-cover max-h-[460px]"
            />
          </div>
        )}

        {/* Post Content */}
        <div
          className="prose prose-blue max-w-none text-text leading-relaxed text-base prose-headings:text-text prose-p:text-text prose-strong:text-text prose-img:rounded-xl prose-img:border prose-img:border-border prose-img:shadow-sm"
          dangerouslySetInnerHTML={{ __html: post.content || '' }}
        />

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="mt-8 pt-6 border-t border-border flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-text-secondary flex items-center gap-1">
              <TagIcon size={14} /> Thẻ liên quan:
            </span>
            {post.tags.map((tag) => (
              <Link
                key={tag.id || tag.slug}
                to={`/tags/${tag.slug}`}
                className="text-xs text-primary bg-primary/5 hover:bg-primary/10 border border-primary/10 px-3 py-1 rounded-lg font-medium transition-colors"
              >
                #{tag.name}
              </Link>
            ))}
          </div>
        )}

        {/* Post Reaction & Social Bar */}
        <div className="mt-6 pt-6 border-t border-border flex items-center justify-between flex-wrap gap-3">
          <ReactionButtons
            postId={post.id}
            initialCounts={post.reaction_breakdown || {
              helpful: post.helpful_count || post.helpfulCount || 0,
              like: 0,
              informative: 0,
              total: post.helpful_count || post.helpfulCount || 0,
            }}
            initialUserReaction={post.user_reaction}
            size="md"
          />

          <div className="flex items-center gap-2">
            <BookmarkButton
              postId={post.id}
              initialIsBookmarked={post.is_bookmarked || false}
              showLabel
              className="border border-border"
            />
            <button
              type="button"
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border text-text-secondary hover:text-text hover:bg-slate-50 text-sm font-medium transition-colors"
            >
              <Share2 size={18} />
              <span>Chia sẻ</span>
            </button>
            <button
              type="button"
              onClick={() => setShowReportModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border text-danger hover:bg-red-50 text-sm font-medium transition-colors"
              title="Báo cáo bài viết vi phạm"
            >
              <Flag size={16} />
              <span className="hidden sm:inline">Báo cáo</span>
            </button>
          </div>
        </div>
      </article>

      {/* Nested Comments Section */}
      <div id="comments">
        <CommentTree
          postId={post.id}
          totalComments={post.comment_count || post.commentCount || 0}
        />
      </div>

      {showReportModal && (
        <ReportModal
          isOpen={showReportModal}
          targetType="post"
          targetId={post.id}
          targetTitle={post.title}
          onClose={() => setShowReportModal(false)}
        />
      )}
    </div>
  );
};

export default PostDetailPage;

