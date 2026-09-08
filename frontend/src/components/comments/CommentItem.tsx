import React, { useState } from 'react';
import {
  MessageSquare,
  Trash2,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Flag,
  CheckCircle2,
} from 'lucide-react';
import { Comment } from '../../types';
import { CommentForm } from './CommentForm';
import { ReportModal } from '../common/ReportModal';
import { useAuth } from '../../hooks/useAuth';
import { formatRelativeTime, getAvatarUrl, cn } from '../../lib/utils';
import {
  AcceptedAnswerBadge,
  AnonymousBadge,
  VerifiedDoctorBadge,
  isVerifiedDoctor,
} from '../common/Badges';

interface CommentItemProps {
  comment: Comment;
  onReply: (parentId: string, content: string, isAnonymous: boolean) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  onAcceptAnswer?: (commentId: string | null) => Promise<void>;
  canAcceptAnswer?: boolean;
  depth?: number;
}

export const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  onReply,
  onDelete,
  onAcceptAnswer,
  canAcceptAnswer = false,
  depth = 0,
}) => {
  const { user } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  const author = comment.author;
  const isVerified = isVerifiedDoctor(author);
  const isDoctor = author?.role?.toUpperCase() === 'DOCTOR' && !isVerified;
  const isAccepted = !!comment.is_accepted;
  // Only top-level comments answer the question; replies are discussion.
  const canMarkAccepted = canAcceptAnswer && depth === 0 && !comment.is_deleted;
  const isAuthor = user && author && user.id === author.id;
  const canDelete = user && (isAuthor || user.role?.toUpperCase() === 'ADMIN' || user.role?.toUpperCase() === 'MODERATOR');

  const handleReplySubmit = async (content: string, isAnonymous: boolean) => {
    await onReply(comment.id, content, isAnonymous);
    setIsReplying(false);
  };

  const handleDelete = async () => {
    if (window.confirm('Bạn có chắc chắn muốn xóa bình luận này?')) {
      await onDelete(comment.id);
    }
  };

  const hasReplies = comment.replies && comment.replies.length > 0;

  return (
    <div className={cn('relative flex flex-col', depth > 0 && 'mt-2')}>
      {/* Indentation line on child items */}
      {depth > 0 && (
        <div
          className="absolute left-0 top-0 bottom-0 border-l-2 border-slate-200 hover:border-primary/50 transition-colors"
          style={{
            // Cap left indent at depth 4 to preserve layout on mobile
            marginLeft: depth <= 4 ? '-12px' : '-8px',
          }}
        />
      )}

      <div
        className={cn(
          'px-3 py-2.5 rounded-lg border border-border bg-white transition-colors hover:border-slate-300',
          isAccepted && 'border-emerald-300 bg-emerald-50/40 hover:border-emerald-400',
          comment.is_deleted && 'bg-slate-50 border-dashed text-slate-400'
        )}
      >
        {/* Comment Header */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Collapse toggle button */}
            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1 text-slate-400 hover:text-primary rounded hover:bg-slate-100 transition-colors"
              title={isCollapsed ? 'Mở rộng bình luận' : 'Thu gọn bình luận'}
            >
              {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
            </button>

            {!comment.is_deleted && (
              <img
                src={getAvatarUrl(author, author?.full_name || author?.username || 'User')}
                alt={author?.full_name || 'Author'}
                className="w-6 h-6 rounded-full object-cover border border-border"
              />
            )}

            <div className="flex items-center gap-1.5 flex-wrap text-[12px]">
              <span className="font-bold text-text">
                {comment.is_deleted
                  ? '[Người dùng ẩn danh]'
                  : author?.full_name || author?.username || 'Người dùng'}
              </span>

              {isDoctor && !comment.is_deleted && (
                <span className="flex items-center gap-0.5 bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded text-[10px]">
                  <ShieldCheck size={11} aria-hidden="true" />
                  BS.
                </span>
              )}

              {!comment.is_deleted && <VerifiedDoctorBadge user={author} />}
              {comment.is_anonymous && !comment.is_deleted && <AnonymousBadge />}
              {isAccepted && <AcceptedAnswerBadge />}

              {author?.specialty && !comment.is_deleted && (
                <span className="text-text-secondary">({author.specialty})</span>
              )}

              <span className="text-slate-400">•</span>
              <span className="text-text-secondary">
                {formatRelativeTime(comment.created_at || comment.createdAt)}
              </span>
            </div>
          </div>

          {/* Accept as the answer — only the asker or staff see this */}
          {canMarkAccepted && onAcceptAnswer && (
            <button
              type="button"
              onClick={() => onAcceptAnswer(isAccepted ? null : comment.id)}
              title={isAccepted ? 'Bỏ chọn câu trả lời này' : 'Chọn làm câu trả lời'}
              className={cn(
                'flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors',
                isAccepted
                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  : 'text-slate-400 hover:bg-emerald-50 hover:text-emerald-700',
              )}
            >
              <CheckCircle2 size={14} aria-hidden="true" />
              <span className="hidden sm:inline">{isAccepted ? 'Đã chọn' : 'Chọn'}</span>
            </button>
          )}

          {/* Delete action */}
          {canDelete && !comment.is_deleted && (
            <button
              type="button"
              onClick={handleDelete}
              className="text-slate-400 hover:text-danger p-1 rounded hover:bg-red-50 transition-colors"
              title="Xóa bình luận"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>

        {/* Collapsed State Summary */}
        {isCollapsed ? (
          <div
            onClick={() => setIsCollapsed(false)}
            className="text-[12px] text-text-secondary italic cursor-pointer hover:text-primary pl-6 py-0.5"
          >
            Bình luận đã thu gọn {hasReplies && `(${comment.replies.length} phản hồi)`} — nhấn để mở
          </div>
        ) : (
          <>
            {/* Comment Body */}
            <div className="pl-6 text-[13px] text-text whitespace-pre-wrap break-words leading-6 mb-2">
              {comment.is_deleted ? (
                <span className="italic text-slate-400 font-normal">
                  [Bình luận đã bị xóa]
                </span>
              ) : (
                comment.content
              )}
            </div>

            {/* Comment Action Bar */}
            {!comment.is_deleted && (
              <div className="pl-6 flex items-center gap-2 text-[12px]">
                {/* Reply Button */}
                <button
                  type="button"
                  onClick={() => setIsReplying(!isReplying)}
                  className={cn(
                    'flex items-center gap-1 font-medium px-2 py-1 rounded transition-colors',
                    isReplying
                      ? 'text-primary bg-primary/10'
                      : 'text-text-secondary hover:text-primary hover:bg-slate-100'
                  )}
                >
                  <MessageSquare size={14} />
                  <span>Trả lời</span>
                </button>

                {/* Report Comment Button */}
                <button
                  type="button"
                  onClick={() => setShowReportModal(true)}
                  className="flex items-center gap-1 font-medium px-2 py-1 rounded text-text-secondary hover:text-danger hover:bg-red-50 transition-colors"
                  title="Báo cáo bình luận vi phạm"
                >
                  <Flag size={13} />
                  <span>Báo cáo</span>
                </button>
              </div>
            )}

            {/* Inline Reply Form */}
            {isReplying && (
              <div className="pl-6 mt-2.5 pt-2.5 border-t border-border">
                <CommentForm
                  onSubmit={handleReplySubmit}
                  onCancel={() => setIsReplying(false)}
                  placeholder={`Trả lời ${author?.full_name || author?.username || 'bình luận'}...`}
                  autoFocus
                  submitLabel="Phản hồi"
                />
              </div>
            )}

            {/* Recursive Replies Tree */}
            {hasReplies && (
              <div className="pl-3 sm:pl-5 mt-2.5 space-y-2">
                {comment.replies.map((reply) => (
                  <CommentItem
                    key={reply.id}
                    comment={reply}
                    onReply={onReply}
                    onDelete={onDelete}
                    onAcceptAnswer={onAcceptAnswer}
                    depth={depth + 1}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {showReportModal && (
        <ReportModal
          isOpen={showReportModal}
          targetType="comment"
          targetId={comment.id}
          targetTitle={comment.content.slice(0, 60)}
          onClose={() => setShowReportModal(false)}
        />
      )}
    </div>
  );
};

export default CommentItem;

