import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TagWithCount } from '../../types';
import { tagService } from '../../services/tagService';
import { statsService, CommunityStats, FeaturedDoctor } from '../../services/statsService';
import { getAvatarUrl } from '../../lib/utils';
import { VerifiedDoctorBadge } from '../common/Badges';

/** 12543 -> "12.5K". Ô thống kê chỉ có chỗ cho vài ký tự. */
const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

const fallbackTags: TagWithCount[] = [
  { id: '1', name: 'Sốt xuất huyết', slug: 'sot-xuat-huyet', post_count: 48 },
  { id: '2', name: 'Covid-19', slug: 'covid-19', post_count: 36 },
  { id: '3', name: 'Đau dạ dày', slug: 'dau-da-day', post_count: 29 },
  { id: '4', name: 'Tiêm chủng', slug: 'tiem-chung', post_count: 24 },
  { id: '5', name: 'Dinh dưỡng cho bé', slug: 'dinh-duong-cho-be', post_count: 21 },
  { id: '6', name: 'Mất ngủ', slug: 'mat-ngu', post_count: 18 },
];

export const SidebarRight: React.FC = () => {
  const [tags, setTags] = useState<TagWithCount[]>(fallbackTags);
  const [stats, setStats] = useState<CommunityStats | null>(null);
  const [doctors, setDoctors] = useState<FeaturedDoctor[]>([]);

  useEffect(() => {
    statsService
      .getCommunityStats()
      .then(setStats)
      .catch((err) => console.error('Failed to load community stats', err));

    statsService
      .getFeaturedDoctors(3)
      .then(setDoctors)
      .catch((err) => console.error('Failed to load featured doctors', err));
  }, []);

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

      {/* Featured Doctors — bác sĩ đã xác thực, xếp theo số bài đã duyệt */}
      {doctors.length > 0 && (
        <div className="bg-surface rounded-2xl p-5 shadow-sm border border-border">
          <h3 className="font-bold text-text mb-4 flex items-center gap-2">
            <span className="w-1.5 h-6 bg-accent rounded-full block" />
            Bác sĩ nổi bật
          </h3>
          <div className="flex flex-col gap-3.5">
            {doctors.map((doc) => (
              <div key={doc.id} className="flex items-center gap-3 group">
                <img
                  src={getAvatarUrl(doc, doc.full_name || doc.username)}
                  alt={doc.full_name || doc.username}
                  className="w-10 h-10 rounded-full border-2 border-transparent group-hover:border-primary transition-colors object-cover"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 min-w-0">
                    <Link
                      to={`/users/${doc.id}`}
                      className="text-sm font-bold text-text group-hover:text-primary transition-colors truncate"
                    >
                      {doc.full_name || doc.username}
                    </Link>
                    <VerifiedDoctorBadge user={doc} />
                  </div>
                  <div className="text-xs text-text-secondary truncate">
                    {doc.specialty || 'Bác sĩ'}
                    {doc.post_count > 0 && ` • ${doc.post_count} bài`}
                  </div>
                </div>
                <Link
                  to="/create-post?type=QUESTION"
                  className="ml-auto text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-lg font-medium hover:bg-primary hover:text-white transition-colors"
                >
                  Hỏi
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="bg-surface rounded-2xl p-5 shadow-sm border border-border">
        <h3 className="font-bold text-text mb-4 flex items-center gap-2">
          <span className="w-1.5 h-6 bg-success rounded-full block" />
          Thống kê cộng đồng
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center p-3 bg-slate-50 rounded-xl">
            <div className="text-xl font-extrabold text-primary">
              {stats ? compact.format(stats.total_members) : '—'}
            </div>
            <div className="text-xs text-text-secondary mt-0.5">Thành viên</div>
          </div>
          <div className="text-center p-3 bg-slate-50 rounded-xl">
            <div className="text-xl font-extrabold text-primary-dark">
              {stats ? compact.format(stats.total_posts) : '—'}
            </div>
            <div className="text-xs text-text-secondary mt-0.5">Bài viết</div>
          </div>
          <div className="text-center p-3 bg-slate-50 rounded-xl col-span-2">
            <div className="text-xl font-extrabold text-success">
              {stats ? compact.format(stats.total_solved_questions) : '—'}
            </div>
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
