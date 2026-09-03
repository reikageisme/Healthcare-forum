import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LayoutGrid } from 'lucide-react';
import { categoryService } from '../../services/categoryService';
import { Category } from '../../types';
import { rootsOf } from '../../lib/categoryTree';
import { FallbackCategoryIcon, isEmojiIcon, resolveCategoryIcon } from '../../lib/categoryIcon';

/**
 * Dải chuyên mục trên đầu bảng tin.
 *
 * Sidebar trái là cây đầy đủ nhưng biến mất trên màn hẹp, và trang chủ trước
 * đây không có lối nào đi thẳng vào một chuyên mục. Dải này chỉ hiện các
 * chuyên mục gốc — đủ để bắt đầu duyệt, không lặp lại cả cây.
 */

const Glyph: React.FC<{ icon?: string | null }> = ({ icon }) => {
  if (isEmojiIcon(icon)) return <span className="text-base leading-none">{icon}</span>;
  const Icon = resolveCategoryIcon(icon) ?? FallbackCategoryIcon;
  return <Icon size={16} className="text-primary" />;
};

export const CategoryStrip: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    categoryService
      .getCategories()
      .then(setCategories)
      .catch((err) => console.error('Failed to load categories', err));
  }, []);

  const roots = rootsOf(categories);
  if (roots.length === 0) return null;

  return (
    <nav aria-label="Chuyên mục" className="bg-surface rounded-2xl border border-border shadow-sm p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-text flex items-center gap-2">
          <LayoutGrid size={16} className="text-primary" aria-hidden="true" />
          Danh mục
        </h2>
        <Link to="/forum" className="text-xs font-semibold text-primary hover:text-primary-dark transition-colors">
          Xem diễn đàn
        </Link>
      </div>
      <div className="flex flex-wrap gap-2">
        {roots.map((cat) => (
          <Link
            key={cat.id}
            to={`/forum/${cat.slug}`}
            className="inline-flex items-center gap-2 whitespace-nowrap px-3 py-2 rounded-xl border border-border bg-white text-xs font-semibold text-text-secondary hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-colors"
          >
            <Glyph icon={cat.icon} />
            <span className="truncate max-w-[180px]">{cat.name}</span>
            {typeof cat.post_count === 'number' && cat.post_count > 0 && (
              <span className="text-[10px] text-slate-400 tabular-nums">{cat.post_count}</span>
            )}
          </Link>
        ))}
      </div>
    </nav>
  );
};

export default CategoryStrip;
