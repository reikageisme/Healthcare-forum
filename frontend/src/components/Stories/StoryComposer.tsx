import React, { useState } from 'react';
import { X, Send } from 'lucide-react';
import { ImageUploader } from '../common/ImageUploader';
import { storyService } from '../../services/storyService';
import { describeUploadError } from '../../lib/uploadError';

interface StoryComposerProps {
  onClose: () => void;
  onCreated: () => void;
}

const MAX_CAPTION = 280;

export const StoryComposer: React.FC<StoryComposerProps> = ({ onClose, onCreated }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageUrl) {
      setErrorMsg('Vui lòng chọn một ảnh cho story.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await storyService.createStory({ image_url: imageUrl, caption: caption.trim() || null });
      onCreated();
      onClose();
    } catch (err) {
      // A story cannot be queued for review, so the server refuses risky
      // content outright and its message explains why. Show it verbatim.
      console.error('Failed to create story', err);
      setErrorMsg(describeUploadError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl border border-border bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <h3 className="text-lg font-bold leading-tight text-slate-900">Đăng story</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <ImageUploader label="Ảnh story" value={imageUrl} onChange={setImageUrl} />

          <div>
            <label htmlFor="story-caption" className="mb-1 block text-sm font-semibold text-text">
              Chú thích
            </label>
            <textarea
              id="story-caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, MAX_CAPTION))}
              rows={3}
              placeholder="Một mẹo sức khỏe ngắn, một nhắc nhở..."
              className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <div className="mt-1 flex items-center justify-between text-xs text-text-secondary">
              <span>Story sẽ tự ẩn sau 24 giờ.</span>
              <span>
                {caption.length}/{MAX_CAPTION}
              </span>
            </div>
          </div>

          {errorMsg && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs leading-relaxed text-danger">
              {errorMsg}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !imageUrl}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary-dark disabled:opacity-50"
            >
              <Send size={15} />
              {isSubmitting ? 'Đang đăng...' : 'Đăng story'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StoryComposer;
