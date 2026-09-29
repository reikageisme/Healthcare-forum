import React, { useEffect, useState } from 'react';
import { BookOpen, HelpCircle, MessageSquare, Search } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export const CommunityHero: React.FC<{ query?: string }> = ({ query = '' }) => {
  const [term, setTerm] = useState(query);
  const navigate = useNavigate();

  useEffect(() => setTerm(query), [query]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = term.trim();
    navigate(value ? `/?search=${encodeURIComponent(value)}` : '/');
  };

  const actions = [
    { label: 'Đặt câu hỏi', icon: HelpCircle, to: '/create-post?type=QUESTION' },
    { label: 'Chia sẻ kinh nghiệm', icon: MessageSquare, to: '/create-post?type=SHARE' },
    { label: 'Xem chuyên mục', icon: BookOpen, to: '#forum-categories' },
  ];

  return (
    <section className="relative mb-5 overflow-hidden rounded-3xl bg-gradient-to-br from-[#164d9b] via-[#2576cf] to-[#2aa7a0] px-5 py-7 text-white shadow-xl sm:px-8 sm:py-9">
      <div className="pointer-events-none absolute -right-12 -top-20 h-56 w-56 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-cyan-200/10" />
      <div className="relative max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-100">Cộng đồng sức khỏe Việt Nam</p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">Hỏi đúng nơi, nhận chia sẻ đáng tin cậy</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-blue-50/90">
          Tìm chủ đề sức khỏe, trao đổi kinh nghiệm và kết nối với bác sĩ đã xác thực.
        </p>

        <form onSubmit={submit} className="relative mt-5 max-w-2xl">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            aria-label="Tìm kiếm trên diễn đàn"
            placeholder="Tìm triệu chứng, chuyên khoa hoặc chủ đề..."
            className="h-[52px] w-full rounded-2xl border border-white/30 bg-white py-3.5 pl-12 pr-14 text-sm font-medium text-slate-900 shadow-lg placeholder:text-slate-500 focus:border-white focus:outline-none focus:ring-4 focus:ring-white/20"
          />
          <button
            type="submit"
            aria-label="Tìm kiếm"
            className="absolute right-2 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl bg-primary text-white transition-colors hover:bg-primary-dark"
          >
            <Search size={18} />
          </button>
        </form>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {actions.map((action) => {
            const content = (
              <>
                <action.icon size={16} aria-hidden="true" />
                {action.label}
              </>
            );
            const className = 'flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2.5 text-xs font-bold backdrop-blur-sm transition-colors hover:bg-white/20';
            return action.to.startsWith('#') ? (
              <a key={action.label} href={action.to} className={className}>{content}</a>
            ) : (
              <Link key={action.label} to={action.to} className={className}>{content}</Link>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default CommunityHero;
