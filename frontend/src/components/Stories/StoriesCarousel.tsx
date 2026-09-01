import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Loader2 } from 'lucide-react';
import { StoryGroup } from '../../types';
import { storyService } from '../../services/storyService';
import { useAuthStore } from '../../stores/authStore';
import { getAvatarUrl } from '../../lib/utils';
import { StoryComposer } from './StoryComposer';
import { StoryViewer } from './StoryViewer';

const StoriesCarousel: React.FC = () => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentUser = useAuthStore((state) => state.user);

  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showComposer, setShowComposer] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setGroups(await storyService.getStories());
    } catch (err) {
      console.error('Failed to load stories', err);
      setGroups([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const scroll = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -300 : 300, behavior: 'smooth' });
  };

  // Nothing to show and nothing to post: the row would be an empty box.
  if (!isLoading && groups.length === 0 && !currentUser) return null;

  return (
    <>
      <div className="relative mb-6 rounded-xl border border-border bg-surface p-4 shadow-sm">
        {groups.length > 3 && (
          <button
            type="button"
            onClick={() => scroll('left')}
            aria-label="Cuộn sang trái"
            className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-border bg-white p-1.5 text-text shadow-md hover:text-primary"
          >
            <ChevronLeft size={20} />
          </button>
        )}

        <div
          ref={scrollRef}
          className="no-scrollbar flex snap-x gap-4 overflow-x-auto scroll-smooth"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {currentUser && (
            <button
              type="button"
              onClick={() => setShowComposer(true)}
              className="flex min-w-[72px] shrink-0 snap-start flex-col items-center gap-2"
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-slate-300 bg-slate-50 transition-colors hover:border-primary hover:bg-slate-100">
                <Plus size={24} className="text-slate-400" aria-hidden="true" />
              </span>
              <span className="w-full truncate text-center text-xs font-medium text-text">
                Của bạn
              </span>
            </button>
          )}

          {isLoading ? (
            <div className="flex items-center gap-2 px-3 py-6 text-xs text-text-secondary">
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              Đang tải story...
            </div>
          ) : groups.length === 0 ? (
            <div className="flex items-center px-3 py-6 text-xs text-text-secondary">
              Chưa có story nào. Đăng cái đầu tiên đi.
            </div>
          ) : (
            groups.map((group, index) => (
              <button
                key={group.author.id}
                type="button"
                onClick={() => setViewerIndex(index)}
                className="group flex min-w-[72px] shrink-0 snap-start flex-col items-center gap-2"
              >
                {/* The gradient ring is the unread affordance every stories UI uses. */}
                <span className="block rounded-full bg-gradient-to-tr from-primary to-fuchsia-500 p-[2px]">
                  <span className="block rounded-full bg-white p-[2px]">
                    <img
                      src={getAvatarUrl(group.author, group.author.full_name || group.author.username)}
                      alt=""
                      className="h-14 w-14 rounded-full object-cover transition-transform group-hover:scale-105"
                    />
                  </span>
                </span>
                <span className="w-full truncate text-center text-xs font-medium text-text">
                  {group.author.id === currentUser?.id
                    ? 'Story của bạn'
                    : group.author.full_name || group.author.username}
                </span>
              </button>
            ))
          )}
        </div>

        {groups.length > 3 && (
          <button
            type="button"
            onClick={() => scroll('right')}
            aria-label="Cuộn sang phải"
            className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-border bg-white p-1.5 text-text shadow-md hover:text-primary"
          >
            <ChevronRight size={20} />
          </button>
        )}
      </div>

      {showComposer && (
        <StoryComposer onClose={() => setShowComposer(false)} onCreated={load} />
      )}

      {viewerIndex !== null && (
        <StoryViewer
          groups={groups}
          startGroupIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onChanged={load}
        />
      )}
    </>
  );
};

export default StoriesCarousel;
