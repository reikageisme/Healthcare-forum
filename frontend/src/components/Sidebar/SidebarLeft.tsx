import React, { useEffect, useState } from 'react';
import {
  Home,
  MessageCircle,
  BookOpen,
  Star,
  Bookmark,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { categoryService } from '../../services/categoryService';
import { Category } from '../../types';
import { childrenMap, rootsOf } from '../../lib/categoryTree';
import {
  FallbackCategoryIcon,
  isEmojiIcon,
  resolveCategoryIcon,
} from '../../lib/categoryIcon';

const CategoryGlyph: React.FC<{ icon?: string | null; size?: number }> = ({ icon, size = 16 }) => {
  if (isEmojiIcon(icon)) {
    return (
      <span className="w-4 text-center flex-shrink-0 leading-none" aria-hidden="true">
        {icon}
      </span>
    );
  }
  const Icon = resolveCategoryIcon(icon) ?? FallbackCategoryIcon;
  return (
    <Icon size={size} className="text-slate-400 group-hover:text-primary flex-shrink-0" />
  );
};

const mainNav = [
  { name: 'Trang chủ', icon: Home, path: '/' },
  { name: 'Hỏi đáp', icon: MessageCircle, path: '/?type=question' },
  { name: 'Bài viết', icon: BookOpen, path: '/?type=article' },
  { name: 'Đánh giá', icon: Star, path: '/?type=review' },
  { name: 'Đã lưu', icon: Bookmark, path: '/bookmarks' },
];

/** Có chuyên mục nào trong nhánh đang được mở không. */
function branchHasSlug(
  node: Category,
  slug: string | null,
  tree: Map<string, Category[]>,
): boolean {
  if (!slug) return false;
  if (node.slug === slug) return true;
  return (tree.get(node.id) ?? []).some((child) => branchHasSlug(child, slug, tree));
}

/**
 * One node of the category tree, rendered recursively so a third level works
 * the same as the first. A branch starts open at the top level or when the
 * category being viewed sits inside it — deeper branches stay folded, which
 * is what keeps a sidebar of forty specialties readable.
 */
const CategoryBranch: React.FC<{
  node: Category;
  depth: number;
  tree: Map<string, Category[]>;
  activeSlug: string | null;
}> = ({ node, depth, tree, activeSlug }) => {
  const kids = tree.get(node.id) ?? [];
  const [open, setOpen] = useState(
    depth === 1 || kids.some((k) => branchHasSlug(k, activeSlug, tree)),
  );
  const isActive = node.slug === activeSlug;

  return (
    <div>
      <div className="flex items-center">
        <Link
          to={`/category/${node.slug}`}
          className={cn(
            'flex items-center gap-2 px-3 rounded-lg group flex-1 min-w-0 transition-colors',
            depth === 1 ? 'py-2 text-xs font-medium' : 'py-1.5 text-xs',
            isActive
              ? 'bg-primary/10 text-primary font-semibold'
              : 'text-text-secondary hover:bg-slate-100 hover:text-primary',
          )}
        >
          <CategoryGlyph icon={node.icon} size={depth === 1 ? 16 : 14} />
          <span className="truncate flex-1">{node.name}</span>
          {typeof node.post_count === 'number' && node.post_count > 0 && (
            <span className="text-[10px] text-slate-400 group-hover:text-primary">
              {node.post_count}
            </span>
          )}
        </Link>

        {kids.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-label={open ? `Thu gọn ${node.name}` : `Mở rộng ${node.name}`}
            className="p-1 rounded-md text-slate-400 hover:text-primary hover:bg-slate-100 shrink-0"
          >
            <ChevronDown
              size={14}
              className={cn('transition-transform', open && 'rotate-180')}
            />
          </button>
        )}
      </div>

      {open && kids.length > 0 && (
        <div className="flex flex-col gap-0.5 pl-3 ml-3 border-l border-border">
          {kids.map((child) => (
            <CategoryBranch
              key={child.id}
              node={child}
              depth={depth + 1}
              tree={tree}
              activeSlug={activeSlug}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const SidebarLeft: React.FC = () => {
  const location = useLocation();
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    categoryService
      .getCategories()
      .then(setCategories)
      .catch((err) => console.error('Failed to load categories', err));
  }, []);

  // The API returns a flat list carrying parent_id, already in tree order;
  // the nesting (up to three levels) is rebuilt here.
  const rootCategories = rootsOf(categories);
  const childrenOf = childrenMap(categories);

  // /category/:slug and /chuyen-khoa/:slug both land on the category page.
  const activeSlug = /^\/(?:category|chuyen-khoa)\/([^/]+)/.exec(location.pathname)?.[1] ?? null;

  const [openSpecialties, setOpenSpecialties] = useState(true);

  return (
    <div className="flex flex-col gap-6 text-sm font-medium">
      {/* Main Nav */}
      <div className="flex flex-col gap-1">
        {mainNav.map((item) => {
          const isActive =
            item.path === '/'
              ? location.pathname === '/' && !location.search
              : item.path.includes('?')
              ? location.pathname + location.search === item.path
              : location.pathname === item.path || (item.path === '/bookmarks' && location.pathname === '/da-luu');

          return (
            <Link
              key={item.name}
              to={item.path}
              className={cn(
                'flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-colors group',
                isActive
                  ? 'bg-primary/10 text-primary font-bold shadow-sm'
                  : 'text-text-secondary hover:bg-slate-100 hover:text-text'
              )}
            >
              <item.icon
                size={20}
                className={isActive ? 'text-primary' : 'text-text-secondary group-hover:text-primary'}
              />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </div>

      {/* Specialties Accordion — driven by the real category tree */}
      <div>
        <button
          type="button"
          onClick={() => setOpenSpecialties(!openSpecialties)}
          className="flex items-center justify-between w-full px-3 py-2 text-text-secondary hover:text-text uppercase text-xs tracking-wider font-bold mb-1"
        >
          <span>Chuyên khoa</span>
          {openSpecialties ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {openSpecialties && (
          <div className="flex flex-col gap-0.5 pl-2 border-l border-border ml-4 mt-2">
            {rootCategories.length === 0 ? (
              <span className="px-3 py-2 text-xs text-text-secondary italic">
                Chưa có chuyên mục nào.
              </span>
            ) : (
              rootCategories.map((root) => (
                <CategoryBranch
                  key={root.id}
                  node={root}
                  depth={1}
                  tree={childrenOf}
                  activeSlug={activeSlug}
                />
              ))
            )}
          </div>
        )}
      </div>

    </div>
  );
};

export default SidebarLeft;
