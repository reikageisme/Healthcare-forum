import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clock, EyeOff, MessageCircle, XCircle } from 'lucide-react';
import { Post } from '../../types';
import { formatRelativeTime, getAvatarUrl, getPostTypeInfo } from '../../lib/utils';
import { isVerifiedDoctor } from '../common/Badges';

/**
 * Danh sách bài viết dạng bảng.
 *
 * Thẻ feed cao ba trăm pixel mỗi bài, một màn hình đọc được bốn bài. Bảng này
 * là chế độ xem thứ hai cho người muốn quét nhanh ba mươi tiêu đề — cùng dữ
 * liệu, cùng bộ lọc, chỉ đổi cách trình bày. Dùng chung cho trang chủ và cho
 * danh sách chủ đề trong diễn đàn, nên không có hai cách hiển thị lệch nhau.
 *
 * Cột phụ tắt dần theo bề rộng thay vì để bảng tràn ngang; bọc overflow-x-auto
 * để màn hình rất hẹp vẫn cuộn được chứ không phá vỡ trang.
 */

interface PostTableProps {
  posts: Post[];
  /** Ẩn cột chuyên mục khi đang đứng trong chính chuyên mục đó. */
  showCategory?: boolean;
}

export const PostTable: React.FC<PostTableProps> = ({ posts, showCategory = true }) => (
  <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-slate-50 border-b border-border">
            <th className="text-left text-[11px] font-bold uppercase tracking-wider text-text-secondary px-4 py-2.5">
              Chủ đề
            </th>
            {showCategory && (
              <th className="hidden lg:table-cell text-left text-[11px] font-bold uppercase tracking-wider text-text-secondary px-3 py-2.5 w-44">
                Chuyên mục
              </th>
            )}
            <th className="hidden sm:table-cell text-center text-[11px] font-bold uppercase tracking-wider text-text-secondary px-3 py-2.5 w-20">
              Trả lời
            </th>
            <th className="hidden sm:table-cell text-center text-[11px] font-bold uppercase tracking-wider text-text-secondary px-3 py-2.5 w-24">
              Lượt xem
            </th>
            <th className="hidden md:table-cell text-right text-[11px] font-bold uppercase tracking-wider text-text-secondary px-4 py-2.5 w-36">
              Hoạt động
            </th>
          </tr>
        </thead>
        <tbody>
          {posts.map((post) => {
            const author = post.author;
            const typeInfo = getPostTypeInfo(post.post_type || post.type);
            const status = post.status?.toLowerCase();

            return (
              <tr key={post.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70 transition-colors">
                <td className="px-4 py-3 align-middle">
                  <div className="flex items-start gap-3 min-w-0">
                    <img
                      src={getAvatarUrl(author, author?.full_name || author?.username || 'Người dùng')}
                      alt=""
                      aria-hidden="true"
                      className="w-9 h-9 rounded-full object-cover border border-border shrink-0 mt-0.5"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {post.accepted_comment_id && (
                          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                            <CheckCircle2 size={10} aria-hidden="true" />
                            Đã giải đáp
                          </span>
                        )}
                        {post.is_anonymous && (
                          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                            <EyeOff size={10} aria-hidden="true" />
                            Ẩn danh
                          </span>
                        )}
                        {status === 'pending' && (
                          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                            <Clock size={10} aria-hidden="true" />
                            Chờ duyệt
                          </span>
                        )}
                        {status === 'rejected' && (
                          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-red-300 bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                            <XCircle size={10} aria-hidden="true" />
                            Đã từ chối
                          </span>
                        )}
                        <span className={`text-[11px] font-bold whitespace-nowrap ${typeInfo.color}`}>
                          [{typeInfo.label}]
                        </span>
                        <Link
                          to={`/posts/${post.id}`}
                          className="text-sm font-semibold text-text hover:text-primary transition-colors line-clamp-1 min-w-0"
                        >
                          {post.title}
                        </Link>
                      </div>
                      <div className="text-[11px] text-text-secondary mt-1 flex items-center gap-1.5 flex-wrap">
                        <span className="truncate max-w-[180px]">
                          {author?.full_name || author?.username || 'Ẩn danh'}
                        </span>
                        {isVerifiedDoctor(author) && (
                          <span className="text-primary font-semibold whitespace-nowrap">· BS. đã xác thực</span>
                        )}
                        <span className="sm:hidden">
                          · <MessageCircle size={11} className="inline -mt-0.5" aria-hidden="true" />{' '}
                          {post.comment_count ?? post.commentCount ?? 0}
                        </span>
                      </div>
                    </div>
                  </div>
                </td>

                {showCategory && (
                  <td className="hidden lg:table-cell px-3 py-3 align-middle">
                    {post.category ? (
                      <Link
                        to={`/forum/${post.category.slug}`}
                        className="inline-block max-w-full truncate whitespace-nowrap text-xs font-semibold text-primary bg-primary/5 border border-primary/10 rounded-lg px-2 py-1 hover:bg-primary/10 transition-colors"
                      >
                        {post.category.name}
                      </Link>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                )}

                <td className="hidden sm:table-cell px-3 py-3 text-center align-middle">
                  <span className="text-[13px] font-bold text-text tabular-nums">
                    {(post.comment_count ?? post.commentCount ?? 0).toLocaleString('vi-VN')}
                  </span>
                </td>
                <td className="hidden sm:table-cell px-3 py-3 text-center align-middle">
                  <span className="text-[13px] font-bold text-text tabular-nums">
                    {(post.view_count ?? 0).toLocaleString('vi-VN')}
                  </span>
                </td>
                <td className="hidden md:table-cell px-4 py-3 text-right align-middle">
                  <span className="text-[11px] text-text-secondary whitespace-nowrap">
                    {formatRelativeTime(post.created_at || post.createdAt)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
);

export default PostTable;
