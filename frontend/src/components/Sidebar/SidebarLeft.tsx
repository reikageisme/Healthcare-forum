import React, { useEffect, useState } from 'react';
import {
  Home,
  MessageCircle,
  BookOpen,
  Star,
  Bookmark,
  Building2,
  Building,
  Pill,
  FlaskConical,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { categoryService } from '../../services/categoryService';
import { Category } from '../../types';
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

const facilities = [
  { name: 'Bệnh viện', icon: Building2, slug: 'benh-vien' },
  { name: 'Phòng khám', icon: Building, slug: 'phong-kham' },
  { name: 'Nhà thuốc', icon: Pill, slug: 'nha-thuoc' },
  { name: 'Phòng xét nghiệm', icon: FlaskConical, slug: 'xet-nghiem' },
];

export const SidebarLeft: React.FC = () => {
  const location = useLocation();
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    categoryService
      .getCategories()
      .then(setCategories)
      .catch((err) => console.error('Failed to load categories', err));
  }, []);

  // The API returns a flat list carrying parent_id, ordered with each child
  // directly after its parent; the two-level tree is rebuilt here.
  const rootCategories = categories.filter((c) => !c.parent_id);
  const childrenOf = new Map<string, Category[]>();
  for (const c of categories) {
    if (!c.parent_id) continue;
    const list = childrenOf.get(c.parent_id) ?? [];
    list.push(c);
    childrenOf.set(c.parent_id, list);
  }

  const [openSpecialties, setOpenSpecialties] = useState(true);
  const [openFacilities, setOpenFacilities] = useState(true);

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
              rootCategories.map((root) => {
                const children = childrenOf.get(root.id) ?? [];
                return (
                  <div key={root.id}>
                    <Link
                      to={`/category/${root.slug}`}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-text-secondary hover:bg-slate-100 hover:text-primary group text-xs font-medium transition-colors"
                    >
                      <CategoryGlyph icon={root.icon} />
                      <span className="truncate flex-1">{root.name}</span>
                      {typeof root.post_count === 'number' && root.post_count > 0 && (
                        <span className="text-[10px] text-slate-400 group-hover:text-primary">
                          {root.post_count}
                        </span>
                      )}
                    </Link>

                    {children.length > 0 && (
                      <div className="flex flex-col gap-0.5 pl-4 ml-3 border-l border-border">
                        {children.map((child) => (
                          <Link
                            key={child.id}
                            to={`/category/${child.slug}`}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-text-secondary hover:bg-slate-100 hover:text-primary group text-xs transition-colors"
                          >
                            <CategoryGlyph icon={child.icon} size={14} />
                            <span className="truncate flex-1">{child.name}</span>
                            {typeof child.post_count === 'number' && child.post_count > 0 && (
                              <span className="text-[10px] text-slate-400 group-hover:text-primary">
                                {child.post_count}
                              </span>
                            )}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Facilities Accordion */}
      <div>
        <button
          type="button"
          onClick={() => setOpenFacilities(!openFacilities)}
          className="flex items-center justify-between w-full px-3 py-2 text-text-secondary hover:text-text uppercase text-xs tracking-wider font-bold mb-1"
        >
          <span>Cơ sở y tế</span>
          {openFacilities ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {openFacilities && (
          <div className="flex flex-col gap-0.5 pl-2 border-l border-border ml-4 mt-2">
            {facilities.map((item) => (
              <Link
                key={item.name}
                to={`/tags/${item.slug}`}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-text-secondary hover:bg-slate-100 hover:text-primary group text-xs font-medium transition-colors"
              >
                <item.icon size={16} className="text-slate-400 group-hover:text-primary flex-shrink-0" />
                <span className="truncate">{item.name}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SidebarLeft;
