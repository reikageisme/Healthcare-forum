import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';

const stories = [
  { id: '1', name: 'Mẹo sức khỏe', emoji: '💡', gradient: 'from-yellow-400 to-orange-500' },
  { id: '2', name: 'Dinh dưỡng', emoji: '🥗', gradient: 'from-green-400 to-emerald-600' },
  { id: '3', name: 'Thể dục', emoji: '🏃‍♂️', gradient: 'from-blue-400 to-indigo-600' },
  { id: '4', name: 'Bệnh lý', emoji: '🦠', gradient: 'from-red-400 to-rose-600' },
  { id: '5', name: 'Thuốc', emoji: '💊', gradient: 'from-sky-400 to-primary' },
  { id: '6', name: 'Tâm lý', emoji: '🧠', gradient: 'from-purple-400 to-fuchsia-600' },
  { id: '7', name: 'Thai sản', emoji: '🤰', gradient: 'from-pink-400 to-rose-500' },
  { id: '8', name: 'Nhi khoa', emoji: '👶', gradient: 'from-blue-400 to-accent' },
];

const StoriesCarousel: React.FC = () => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 300;
      scrollRef.current.scrollBy({ left: dir === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="relative bg-surface p-4 rounded-xl shadow-sm border border-border mb-6">
      <button 
        onClick={() => scroll('left')}
        className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-white p-1.5 rounded-full shadow-md text-text hover:text-primary border border-border"
      >
        <ChevronLeft size={20} />
      </button>

      <div 
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto no-scrollbar scroll-smooth snap-x"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {/* Add story button */}
        <div className="flex flex-col items-center gap-2 min-w-[72px] cursor-pointer snap-start">
          <div className="w-16 h-16 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center bg-slate-50 hover:bg-slate-100 transition-colors">
            <Plus size={24} className="text-slate-400" />
          </div>
          <span className="text-xs font-medium text-text text-center w-full truncate">Của bạn</span>
        </div>

        {/* Story items */}
        {stories.map((story) => (
          <div key={story.id} className="flex flex-col items-center gap-2 min-w-[72px] cursor-pointer group snap-start">
            <div className={`w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr ${story.gradient}`}>
              <div className="w-full h-full bg-white rounded-full flex items-center justify-center text-2xl group-hover:scale-105 transition-transform">
                {story.emoji}
              </div>
            </div>
            <span className="text-xs font-medium text-text text-center w-full truncate">{story.name}</span>
          </div>
        ))}
      </div>

      <button 
        onClick={() => scroll('right')}
        className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-white p-1.5 rounded-full shadow-md text-text hover:text-primary border border-border"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
};

export default StoriesCarousel;
