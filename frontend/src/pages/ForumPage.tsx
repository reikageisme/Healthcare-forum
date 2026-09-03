import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, Plus, ChevronRight } from 'lucide-react';
import { forumService, ForumCategory } from '../services/forumService';
import { childrenMap, rootsOf } from '../lib/categoryTree';
import { FallbackCategoryIcon, isEmojiIcon, resolveCategoryIcon } from '../lib/categoryIcon';
import { formatRelativeTime } from '../lib/utils';
import { PostCardSkeleton } from '../components/common/LoadingSkeleton';
import { EmptyState } from '../components/common/EmptyState';

/**
 * Trang chủ diễn đàn.
 *
 * Không có bảng "forum" riêng: một box là một chuyên mục, một thớt là một bài
 * viết, một trả lời là một bình luận. Chuyên mục gốc đóng vai nhóm, các con
 * của nó là những box bấm vào được — giống hệt cách voz xếp trang chủ. Chuyên
 * mục gốc không có con thì tự nó là một box, nếu không nó sẽ biến mất khỏi
 * trang chỉ vì chưa ai thêm mục con.
 */

const Glyph: React.FC<{ icon?: string | null }> = ({ icon }) => {
  if (isEmojiIcon(icon)) {
    return <span className="text-lg leading-none">{icon}</span>;
  }
  const Icon = resolveCategoryIcon(icon) ?? FallbackCategoryIcon;
  return <Icon size={20} />;
};

const BoxRow: React.FC<{ box: ForumCategory; subs: ForumCategory[] }> = ({ box, subs }) => (
  <div className="grid grid-cols-[44px_1fr] sm:grid-cols-[44px_minmax(0,1fr)_72px_80px] 2xl:grid-cols-[44px_minmax(0,1fr)_72px_80px_minmax(180px,220px)] gap-4 items-center px-5 py-3.5 border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60 transition-colors">
    <div className="w-11 h-11 shrink-0 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
      <Glyph icon={box.icon} />
    </div>

    <div className="min-w-0">
      <Link to={`/forum/${box.slug}`} className="block text-[15px] font-bold text-text hover:text-primary transition-colors truncate">
        {box.name}
      </Link>
      {box.description && (
        <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{box.description}</p>
      )}
      {subs.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {subs.slice(0, 5).map((sub) => (
            <Link
              key={sub.id}
              to={`/forum/${sub.slug}`}
              className="text-[11px] font-semibold text-primary bg-primary/5 border border-primary/10 rounded-md px-1.5 py-0.5 whitespace-nowrap max-w-[200px] truncate hover:bg-primary/10 transition-colors"
            >
              {sub.name}
            </Link>
          ))}
          {subs.length > 5 && (
            <span className="text-[11px] text-text-secondary px-1 py-0.5 whitespace-nowrap">+{subs.length - 5} mục con</span>
          )}
        </div>
      )}
    </div>

    <div className="hidden sm:block text-center">
      <span className="block text-sm font-bold text-text tabular-nums">{box.thread_count.toLocaleString('vi-VN')}</span>
      <span className="text-[10px] font-semibold text-slate-400 whitespace-nowrap">chủ đề</span>
    </div>
    <div className="hidden sm:block text-center">
      <span className="block text-sm font-bold text-text tabular-nums">{box.reply_count.toLocaleString('vi-VN')}</span>
      <span className="text-[10px] font-semibold text-slate-400 whitespace-nowrap">trả lời</span>
    </div>

    <div className="hidden 2xl:block min-w-0">
      {box.last_post ? (
        <>
          <Link
            to={`/posts/${box.last_post.id}`}
            className="block text-xs font-semibold text-text hover:text-primary truncate transition-colors"
          >
            {box.last_post.title}
          </Link>
          <div className="text-[11px] text-slate-400 mt-0.5 truncate">
            {box.last_post.author_name || 'Ẩn danh'} · {formatRelativeTime(box.last_post.created_at)}
          </div>
        </>
      ) : (
        <span className="text-[11px] text-slate-400 italic whitespace-nowrap">Chưa có bài viết</span>
      )}
    </div>
  </div>
);

export const ForumPage: React.FC = () => {
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    forumService
      .getForumIndex()
      .then(setCategories)
      .catch((err) => console.error('Failed to load forum index', err))
      .finally(() => setLoading(false));
  }, []);

  const roots = rootsOf(categories) as ForumCategory[];
  const childrenOf = childrenMap(categories);

  const totalThreads = categories
    .filter((c) => !c.parent_id)
    .reduce((sum, c) => sum + c.thread_count, 0);
  const totalReplies = categories
    .filter((c) => !c.parent_id)
    .reduce((sum, c) => sum + c.reply_count, 0);

  if (loading) return <PostCardSkeleton />;

  if (roots.length === 0) {
    return (
      <EmptyState
        title="Diễn đàn chưa có chuyên mục nào"
        description="Quản trị viên cần tạo chuyên mục trong trang quản trị trước khi diễn đàn hoạt động."
      />
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl sm:text-[26px] font-extrabold text-text tracking-tight">Diễn đàn Sức khỏe</h1>
          <p className="text-[13px] text-text-secondary mt-1">
            {roots.length} nhóm · {totalThreads.toLocaleString('vi-VN')} chủ đề ·{' '}
            {totalReplies.toLocaleString('vi-VN')} trả lời
          </p>
        </div>
        <Link
          to="/create-post"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-full text-sm font-semibold shadow-sm transition-colors"
        >
          <Plus size={16} />
          Tạo chủ đề
        </Link>
      </div>

      {roots.map((root) => {
        const kids = (childrenOf.get(root.id) ?? []) as ForumCategory[];
        // Nhóm rỗng thì chính nó là box, không thì các con là box.
        const boxes = kids.length > 0 ? kids : [root];

        return (
          <section
            key={root.id}
            className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden mb-5"
          >
            <div className="grid grid-cols-[1fr] sm:grid-cols-[44px_minmax(0,1fr)_72px_80px] 2xl:grid-cols-[44px_minmax(0,1fr)_72px_80px_minmax(180px,220px)] gap-4 items-center px-5 py-3 bg-sidebar border-b border-border">
              <MessageSquare size={16} className="hidden sm:block text-primary-dark mx-auto" aria-hidden="true" />
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-primary-dark truncate">
                {root.name}
              </h2>
              <span className="hidden sm:block text-[10px] font-bold uppercase tracking-wide text-text-secondary text-center whitespace-nowrap">
                Chủ đề
              </span>
              <span className="hidden sm:block text-[10px] font-bold uppercase tracking-wide text-text-secondary text-center whitespace-nowrap">
                Trả lời
              </span>
              <span className="hidden 2xl:block text-[10px] font-bold uppercase tracking-wide text-text-secondary whitespace-nowrap">
                Bài mới nhất
              </span>
            </div>

            {boxes.map((box) => (
              <BoxRow
                key={box.id}
                box={box}
                subs={(childrenOf.get(box.id) ?? []) as ForumCategory[]}
              />
            ))}
          </section>
        );
      })}

      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-secondary hover:text-primary transition-colors"
      >
        Về bảng tin
        <ChevronRight size={15} />
      </Link>
    </div>
  );
};

export default ForumPage;
