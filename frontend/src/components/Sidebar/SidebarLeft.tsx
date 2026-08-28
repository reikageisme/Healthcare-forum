import React, { useState } from 'react';
import {
  Home,
  MessageCircle,
  BookOpen,
  Star,
  Bookmark,
  Stethoscope,
  Scissors,
  Baby,
  Heart,
  Smile,
  Eye,
  Sparkles,
  HeartPulse,
  Brain,
  Bone,
  Building2,
  Building,
  Pill,
  FlaskConical,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '../../lib/utils';

const mainNav = [
  { name: 'Trang chủ', icon: Home, path: '/' },
  { name: 'Hỏi đáp', icon: MessageCircle, path: '/?type=question' },
  { name: 'Bài viết', icon: BookOpen, path: '/?type=article' },
  { name: 'Đánh giá', icon: Star, path: '/?type=review' },
  { name: 'Đã lưu', icon: Bookmark, path: '/bookmarks' },
];

const specialties = [
  { name: 'Nội khoa', icon: Stethoscope, slug: 'noi-khoa' },
  { name: 'Ngoại khoa', icon: Scissors, slug: 'ngoai-khoa' },
  { name: 'Nhi khoa', icon: Baby, slug: 'nhi-khoa' },
  { name: 'Sản phụ khoa', icon: Heart, slug: 'san-phu-khoa' },
  { name: 'Răng hàm mặt', icon: Smile, slug: 'rang-ham-mat' },
  { name: 'Mắt (Nhãn khoa)', icon: Eye, slug: 'mat' },
  { name: 'Da liễu', icon: Sparkles, slug: 'da-lieu' },
  { name: 'Tim mạch', icon: HeartPulse, slug: 'tim-mach' },
  { name: 'Thần kinh', icon: Brain, slug: 'than-kinh' },
  { name: 'Cơ xương khớp', icon: Bone, slug: 'co-xuong-khop' },
];

const facilities = [
  { name: 'Bệnh viện', icon: Building2, slug: 'benh-vien' },
  { name: 'Phòng khám', icon: Building, slug: 'phong-kham' },
  { name: 'Nhà thuốc', icon: Pill, slug: 'nha-thuoc' },
  { name: 'Phòng xét nghiệm', icon: FlaskConical, slug: 'xet-nghiem' },
];

export const SidebarLeft: React.FC = () => {
  const location = useLocation();
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

      {/* Specialties Accordion */}
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
            {specialties.map((item) => (
              <Link
                key={item.name}
                to={`/category/${item.slug}`}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-text-secondary hover:bg-slate-100 hover:text-primary group text-xs font-medium transition-colors"
              >
                <item.icon size={16} className="text-slate-400 group-hover:text-primary flex-shrink-0" />
                <span className="truncate">{item.name}</span>
              </Link>
            ))}
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
