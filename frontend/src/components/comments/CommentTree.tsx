import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MessageSquare, Loader2, ArrowUpDown } from 'lucide-react';
import { Comment } from '../../types';
import { commentService } from '../../services/commentService';
import { CommentForm } from './CommentForm';
import { CommentItem } from './CommentItem';

interface CommentTreeProps {
  postId: string;
  totalComments?: number;
  onCommentCountChange?: (count: number) => void;
  /** Set when the viewer may choose the accepted answer (asker or staff). */
  onAcceptAnswer?: (commentId: string | null) => Promise<void>;
  canAcceptAnswer?: boolean;
}

/** Cứ ngần này một lần thì hỏi lại server xem có ai vừa trả lời không. */
const POLL_MS = 15000;

/** Chèn một phản hồi vào đúng nhánh của nó, giữ nguyên phần còn lại của cây. */
function insertReply(list: Comment[], parentId: string, reply: Comment): Comment[] {
  return list.map((node) => {
    if (node.id === parentId) {
      return { ...node, replies: [...(node.replies ?? []), reply] };
    }
    if (node.replies && node.replies.length > 0) {
      return { ...node, replies: insertReply(node.replies, parentId, reply) };
    }
    return node;
  });
}

export const CommentTree: React.FC<CommentTreeProps> = ({
  postId,
  totalComments = 0,
  onCommentCountChange,
  onAcceptAnswer,
  canAcceptAnswer = false,
}) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');

  /**
   * Đếm số lần cây bị sửa tại chỗ (gửi, xoá, chọn câu trả lời).
   *
   * Một vòng làm mới nền có thể đã rời máy TRƯỚC khi người dùng bấm Gửi và về
   * SAU đó — kết quả cũ ấy sẽ xoá mất bình luận vừa hiện ra, đúng cái cảm giác
   * "phải F5 mới thấy". Mỗi request nhớ giá trị bộ đếm lúc nó khởi hành; về
   * muộn hơn một lần sửa thì bỏ qua.
   */
  const mutationRef = useRef(0);

  const fetchComments = useCallback(
    async (background = false) => {
      const stamp = mutationRef.current;
      try {
        if (!background) setIsLoading(true);
        const data = await commentService.getComments(postId);
        // Làm mới nền không được đè lên thứ người dùng vừa tạo.
        if (background && stamp !== mutationRef.current) return;
        setComments(data);
      } catch (error) {
        // Vòng nền hỏng thì im lặng: danh sách đang hiện vẫn dùng được.
        if (!background) console.error('Failed to load comments', error);
      } finally {
        if (!background) setIsLoading(false);
      }
    },
    [postId],
  );

  useEffect(() => {
    void fetchComments();
  }, [fetchComments]);

  /**
   * Bình luận của người khác cũng phải tự hiện ra.
   *
   * Poll nhẹ thay vì mở một kết nối SSE cho mỗi người đang đọc: cùng kết quả
   * mà không phải đụng tới nginx hay giữ kết nối sống. Tab bị ẩn thì ngừng
   * hỏi — không ai đọc thì hỏi làm gì — và hiện lại thì hỏi ngay một lần.
   */
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') void fetchComments(true);
    };
    const timer = window.setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [fetchComments]);

  // The accepted flag lives on the comments the API returns, so the tree is
  // reloaded after the choice is saved rather than patched in place.
  const handleAccept = async (commentId: string | null) => {
    if (!onAcceptAnswer) return;
    await onAcceptAnswer(commentId);
    mutationRef.current += 1;
    await fetchComments(true);
  };

  const handleRootCommentSubmit = async (content: string, isAnonymous: boolean) => {
    const created = await commentService.createComment(postId, {
      content,
      is_anonymous: isAnonymous,
    });
    mutationRef.current += 1;
    // Hiện ngay bằng chính bản ghi server vừa trả về — không chờ thêm một
    // vòng GET nữa, và cũng không phải đoán nội dung sau khi được làm sạch.
    setComments((prev) => [{ ...created, replies: created.replies ?? [] }, ...prev]);
    if (onCommentCountChange) onCommentCountChange(totalComments + 1);
  };

  const handleReplySubmit = async (parentId: string, content: string, isAnonymous: boolean) => {
    const created = await commentService.createComment(postId, {
      content,
      parent_id: parentId,
      is_anonymous: isAnonymous,
    });
    mutationRef.current += 1;
    setComments((prev) => insertReply(prev, parentId, { ...created, replies: created.replies ?? [] }));
    if (onCommentCountChange) onCommentCountChange(totalComments + 1);
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await commentService.deleteComment(commentId);
      mutationRef.current += 1;
      await fetchComments(true);
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
    <section className="bg-surface rounded-xl p-4 sm:p-5 shadow-sm border border-border mt-4">
      {/* Section Header */}
      <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <MessageSquare className="text-primary w-4 h-4" />
          <h3 className="font-bold text-[15px] text-text">Thảo luận</h3>
          <span className="bg-primary/10 text-primary text-[11px] font-bold px-1.5 py-0.5 rounded">
            {displayCount}
          </span>
        </div>

        {/* Sort Select */}
        <div className="flex items-center gap-1.5 text-[12px] text-text-secondary">
          <ArrowUpDown size={13} />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest')}
            className="bg-slate-50 border border-border rounded-md px-2 py-0.5 text-text text-[12px] focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
          >
            <option value="newest">Mới nhất</option>
            <option value="oldest">Cũ nhất</option>
          </select>
        </div>
      </div>

      {/* Root Comment Form */}
      <div className="mb-5">
        <CommentForm onSubmit={handleRootCommentSubmit} placeholder="Viết trả lời của bạn..." />
      </div>

      {/* Comments List */}
      {isLoading ? (
        <div className="py-10 flex flex-col items-center justify-center text-text-secondary gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="text-[13px]">Đang tải thảo luận...</span>
        </div>
      ) : sortedComments.length === 0 ? (
        <div className="py-8 text-center text-text-secondary">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2 text-slate-400">
            <MessageSquare size={18} />
          </div>
          <p className="font-medium text-[13px] text-text mb-0.5">Chưa có trả lời nào</p>
          <p className="text-[12px] text-text-secondary">
            Hãy là người đầu tiên chia sẻ góc nhìn cho bài viết này.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {sortedComments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              onReply={handleReplySubmit}
              onDelete={handleDeleteComment}
              onAcceptAnswer={handleAccept}
              canAcceptAnswer={canAcceptAnswer}
              depth={0}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default CommentTree;
