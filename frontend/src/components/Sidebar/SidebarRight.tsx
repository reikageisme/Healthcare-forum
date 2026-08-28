import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TagWithCount } from '../../types';
import { tagService } from '../../services/tagService';

const fallbackTags: TagWithCount[] = [
  { id: '1', name: 'Sốt xuất huyết', slug: 'sot-xuat-huyet', post_count: 48 },
  { id: '2', name: 'Covid-19', slug: 'covid-19', post_count: 36 },
  { id: '3', name: 'Đau dạ dày', slug: 'dau-da-day', post_count: 29 },
  { id: '4', name: 'Tiêm chủng', slug: 'tiem-chung', post_count: 24 },
  { id: '5', name: 'Dinh dưỡng cho bé', slug: 'dinh-duong-cho-be', post_count: 21 },
  { id: '6', name: 'Mất ngủ', slug: 'mat-ngu', post_count: 18 },
];

const featuredDoctors = [
  {
    name: 'BS. Trần Văn A',
    specialty: 'Nội tim mạch',
    avatar: 'https://ui-avatars.com/api/?name=Tran+Van+A&background=3B82F6&color=fff',
  },
  {
    name: 'BS. Nguyễn Thị B',
    specialty: 'Nhi khoa',
    avatar: 'https://ui-avatars.com/api/?name=Nguyen+Thi+B&background=60A5FA&color=fff',
  },
  {
    name: 'BS. Lê Văn C',
    specialty: 'Da liễu',
    avatar: 'https://ui-avatars.com/api/?name=Le+Van+C&background=10B981&color=fff',
  },
];

export const SidebarRight: React.FC = () => {
  const [tags, setTags] = useState<TagWithCount[]>(fallbackTags);

  useEffect(() => {
    const fetchHotTags = async () => {
      try {
        const data = await tagService.getHotTags(8);
        if (data && data.length > 0) {
          setTags(data);
        }
      } catch (err) {
        console.error('Failed to load hot tags', err);
      }
    };
    fetchHotTags();
  }, []);

  return (
    <div className="flex flex-col gap-6">
      {/* Trending Topics */}
      <div className="bg-surface rounded-2xl p-5 shadow-sm border border-border">
        <h3 className="font-bold text-text mb-4 flex items-center gap-2">
          <span className="w-1.5 h-6 bg-primary rounded-full block" />
          Chủ đề nổi bật
        </h3>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Link
              key={tag.id || tag.slug}
              to={`/tags/${tag.slug}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-text-secondary text-xs font-semibold rounded-xl hover:bg-primary/10 hover:text-primary transition-colors border border-transparent hover:border-primary/20"
            >
              <span>#{tag.name}</span>
              {tag.post_count > 0 && (
                <span className="text-[10px] bg-white text-primary px-1.5 py-0.2 rounded-full border border-border">
                  {tag.post_count}
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>

      {/* Featured Doctors */}
      <div className="bg-surface rounded-2xl p-5 shadow-sm border border-border">
        <h3 className="font-bold text-text mb-4 flex items-center gap-2">
          <span className="w-1.5 h-6 bg-accent rounded-full block" />
          Bác sĩ nổi bật
        </h3>
        <div className="flex flex-col gap-3.5">
          {featuredDoctors.map((doc, idx) => (
            <div key={idx} className="flex items-center gap-3 group cursor-pointer">
              <img
                src={doc.avatar}
                alt={doc.name}
                className="w-10 h-10 rounded-full border-2 border-transparent group-hover:border-primary transition-colors object-cover"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-text group-hover:text-primary transition-colors truncate">
                  {doc.name}
                </div>
                <div className="text-xs text-text-secondary truncate">{doc.specialty}</div>
              </div>
              <Link
                to={`/create-post?type=QUESTION`}
                className="ml-auto text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-lg font-medium hover:bg-primary hover:text-white transition-colors"
              >
                Hỏi
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="bg-surface rounded-2xl p-5 shadow-sm border border-border">
        <h3 className="font-bold text-text mb-4 flex items-center gap-2">
          <span className="w-1.5 h-6 bg-success rounded-full block" />
          Thống kê cộng đồng
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center p-3 bg-slate-50 rounded-xl">
            <div className="text-xl font-extrabold text-primary">12.5k</div>
            <div className="text-xs text-text-secondary mt-0.5">Thành viên</div>
          </div>
          <div className="text-center p-3 bg-slate-50 rounded-xl">
            <div className="text-xl font-extrabold text-primary-dark">8.2k</div>
            <div className="text-xs text-text-secondary mt-0.5">Bài viết</div>
          </div>
          <div className="text-center p-3 bg-slate-50 rounded-xl col-span-2">
            <div className="text-xl font-extrabold text-success">45.1k</div>
            <div className="text-xs text-text-secondary mt-0.5">Câu hỏi đã được giải đáp</div>
          </div>
        </div>
      </div>

      <div className="text-xs text-text-secondary text-center">
        © 2026 SứcKhỏeVN. All rights reserved.
      </div>
    </div>
  );
};

export default SidebarRight;
