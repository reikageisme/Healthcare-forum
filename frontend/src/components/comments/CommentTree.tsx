import React, { useEffect, useState, useCallback } from 'react';
import { MessageSquare, Loader2, ArrowUpDown } from 'lucide-react';
import { Comment } from '../../types';
import { commentService } from '../../services/commentService';
import { CommentForm } from './CommentForm';
import { CommentItem } from './CommentItem';

interface CommentTreeProps {
  postId: string;
  totalComments?: number;
  onCommentCountChange?: (count: number) => void;
}

export const CommentTree: React.FC<CommentTreeProps> = ({
  postId,
  totalComments = 0,
  onCommentCountChange,
}) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');

  const fetchComments = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await commentService.getComments(postId);
      setComments(data);
    } catch (error) {
      console.error('Failed to load comments', error);
    } finally {
      setIsLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleRootCommentSubmit = async (content: string) => {
    await commentService.createComment(postId, { content });
    await fetchComments();
    if (onCommentCountChange) onCommentCountChange(totalComments + 1);
  };

  const handleReplySubmit = async (parentId: string, content: string) => {
    await commentService.createComment(postId, { content, parent_id: parentId });
    await fetchComments();
    if (onCommentCountChange) onCommentCountChange(totalComments + 1);
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await commentService.deleteComment(commentId);
      await fetchComments();
      if (onCommentCountChange) onCommentCountChange(Math.max(0, totalComments - 1));
    } catch (error) {
      console.error('Failed to delete comment', error);
      alert('Không thể xóa bình luận. Vui lòng thử lại sau.');
    }
  };

  const countAllComments = (list: Comment[]): number => {
    return list.reduce((acc, c) => acc + 1 + (c.replies ? countAllComments(c.replies) : 0), 0);
  };

  const displayCount = countAllComments(comments) || totalComments;

  const sortedComments = [...comments].sort((a, b) => {
    const timeA = new Date(a.created_at || a.createdAt || 0).getTime();
    const timeB = new Date(b.created_at || b.createdAt || 0).getTime();
    return sortBy === 'newest' ? timeB - timeA : timeA - timeB;
  });

  return (
    <section className="bg-surface rounded-2xl p-5 sm:p-7 shadow-sm border border-border mt-6">
      {/* Section Header */}
      <div className="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <MessageSquare className="text-primary w-5 h-5" />
          <h3 className="font-bold text-lg text-text">Bình luận & Thảo luận</h3>
          <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded-full">
            {displayCount}
          </span>
        </div>

        {/* Sort Select */}
        <div className="flex items-center gap-1.5 text-xs text-text-secondary">
          <ArrowUpDown size={14} />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest')}
            className="bg-slate-50 border border-border rounded-lg px-2.5 py-1 text-text text-xs focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
          >
            <option value="newest">Mới nhất</option>
            <option value="oldest">Cũ nhất</option>
          </select>
        </div>
      </div>

      {/* Root Comment Form */}
      <div className="mb-8 p-4 bg-slate-50/70 rounded-xl border border-slate-200">
        <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
          Viết bình luận của bạn
        </h4>
        <CommentForm onSubmit={handleRootCommentSubmit} />
      </div>

      {/* Comments List */}
      {isLoading ? (
        <div className="py-12 flex flex-col items-center justify-center text-text-secondary gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-primary" />
          <span className="text-sm">Đang tải danh sách bình luận...</span>
        </div>
      ) : sortedComments.length === 0 ? (
        <div className="py-10 text-center text-text-secondary">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
            <MessageSquare size={22} />
          </div>
          <p className="font-medium text-sm text-text mb-1">Chưa có bình luận nào</p>
          <p className="text-xs text-text-secondary">
            Hãy là người đầu tiên chia sẻ góc nhìn hoặc đặt câu hỏi cho bài viết này!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedComments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              onReply={handleReplySubmit}
              onDelete={handleDeleteComment}
              depth={0}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default CommentTree;
