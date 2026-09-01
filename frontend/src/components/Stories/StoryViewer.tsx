import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Trash2, Flag, Pause, Play } from 'lucide-react';
import { StoryGroup } from '../../types';
import { storyService } from '../../services/storyService';
import { useAuthStore } from '../../stores/authStore';
import { ReportModal } from '../common/ReportModal';
import { VerifiedDoctorBadge } from '../common/Badges';
import { formatRelativeTime, getAvatarUrl } from '../../lib/utils';

interface StoryViewerProps {
  groups: StoryGroup[];
  startGroupIndex: number;
  onClose: () => void;
  onChanged: () => void;
}

const STORY_DURATION_MS = 5000;
const TICK_MS = 50;

export const StoryViewer: React.FC<StoryViewerProps> = ({
  groups,
  startGroupIndex,
  onClose,
  onChanged,
}) => {
  const currentUser = useAuthStore((state) => state.user);
  const [groupIndex, setGroupIndex] = useState(startGroupIndex);
  const [itemIndex, setItemIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const timerRef = useRef<number | null>(null);

  const group = groups[groupIndex];
  const story = group?.items[itemIndex];

  const goNext = useCallback(() => {
    setProgress(0);
    setItemIndex((i) => {
      const current = groups[groupIndex];
      if (current && i + 1 < current.items.length) return i + 1;
      // End of this author's stories — move to the next author, or close.
      setGroupIndex((g) => {
        if (g + 1 < groups.length) return g + 1;
        onClose();
        return g;
      });
      return 0;
    });
  }, [groupIndex, groups, onClose]);

  const goPrev = useCallback(() => {
    setProgress(0);
    setItemIndex((i) => {
      if (i > 0) return i - 1;
      setGroupIndex((g) => Math.max(0, g - 1));
      return 0;
    });
  }, []);

  // Advance on a timer; pausing is a real affordance because captions on a
  // health tip are worth reading twice.
  useEffect(() => {
    if (isPaused || !story) return undefined;
    timerRef.current = window.setInterval(() => {
      setProgress((p) => {
        const next = p + (TICK_MS / STORY_DURATION_MS) * 100;
        if (next >= 100) {
          goNext();
          return 0;
        }
        return next;
      });
    }, TICK_MS);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [isPaused, story, goNext]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === ' ') {
        e.preventDefault();
        setIsPaused((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    // The page behind must not scroll while a fullscreen viewer is open.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, goNext, goPrev]);

  if (!group || !story) return null;

  const isOwn = currentUser?.id === group.author.id;
  const role = currentUser?.role?.toUpperCase();
  const canDelete = isOwn || role === 'ADMIN' || role === 'MODERATOR';

  const handleDelete = async () => {
    if (!window.confirm('Xóa story này?')) return;
    try {
      await storyService.deleteStory(story.id);
      onChanged();
      onClose();
    } catch (err) {
      console.error('Failed to delete story', err);
      window.alert('Không xóa được story. Vui lòng thử lại.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
      <div className="relative flex h-full w-full max-w-md flex-col">
        {/* Progress bars — one per story in this author's set */}
        <div className="absolute left-0 right-0 top-0 z-20 flex gap-1 p-3">
          {group.items.map((item, i) => (
            <div key={item.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
              <div
                className="h-full bg-white"
                style={{
                  width: i < itemIndex ? '100%' : i === itemIndex ? `${progress}%` : '0%',
                }}
              />
            </div>
          ))}
        </div>

        {/* Author header */}
        <div className="absolute left-0 right-0 top-6 z-20 flex items-center justify-between p-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <img
              src={getAvatarUrl(group.author, group.author.full_name || group.author.username)}
              alt=""
              className="h-8 w-8 rounded-full border border-white/40 object-cover"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-semibold text-white">
                  {group.author.full_name || group.author.username}
                </span>
                <VerifiedDoctorBadge user={group.author} />
              </div>
              <span className="text-[11px] text-white/70">
                {formatRelativeTime(story.created_at)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsPaused((p) => !p)}
              aria-label={isPaused ? 'Tiếp tục' : 'Tạm dừng'}
              className="rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white"
            >
              {isPaused ? <Play size={16} /> : <Pause size={16} />}
            </button>

            {canDelete ? (
              <button
                type="button"
                onClick={handleDelete}
                aria-label="Xóa story"
                className="rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white"
              >
                <Trash2 size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsPaused(true);
                  setShowReport(true);
                }}
                aria-label="Báo cáo story"
                className="rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white"
              >
                <Flag size={16} />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng"
              className="rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Image */}
        <div className="flex flex-1 items-center justify-center">
          <img
            src={story.image_url}
            alt={story.caption || 'Story'}
            className="max-h-full w-full object-contain"
          />
        </div>

        {/* Caption */}
        {story.caption && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-5 pt-12">
            <p className="text-sm leading-relaxed text-white">{story.caption}</p>
          </div>
        )}

        {/* Tap zones. Buttons rather than bare divs so a keyboard reaches them. */}
        <button
          type="button"
          onClick={goPrev}
          aria-label="Story trước"
          className="absolute bottom-0 left-0 top-16 z-10 w-1/3 cursor-default focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <ChevronLeft size={22} className="ml-2 text-white/0 transition-colors hover:text-white/70" />
        </button>
        <button
          type="button"
          onClick={goNext}
          aria-label="Story tiếp theo"
          className="absolute bottom-0 right-0 top-16 z-10 w-1/3 cursor-default focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <ChevronRight size={22} className="ml-auto mr-2 text-white/0 transition-colors hover:text-white/70" />
        </button>
      </div>

      {showReport && (
        <ReportModal
          isOpen={showReport}
          targetType="story"
          targetId={story.id}
          targetTitle={story.caption || 'Story'}
          onClose={() => {
            setShowReport(false);
            setIsPaused(false);
          }}
        />
      )}
    </div>
  );
};

export default StoryViewer;
