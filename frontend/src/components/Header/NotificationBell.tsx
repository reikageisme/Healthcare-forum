import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Loader2, MessageSquare, CornerDownRight, CheckCircle2, XCircle } from 'lucide-react';
import { notificationService } from '../../services/notificationService';
import { AppNotification } from '../../types';
import { useAuthStore } from '../../stores/authStore';
import { formatRelativeTime, getAvatarUrl, cn } from '../../lib/utils';

/**
 * Chuông thông báo.
 *
 * Trước đây nó là một cái icon không gắn với gì cả: bấm vào không có chuyện
 * gì xảy ra, mà người dùng thì không có cách nào biết bài mình vừa đăng đã
 * được duyệt hay có ai trả lời.
 *
 * Hỏi lại mỗi 60 giây, và hỏi ngay khi quay lại tab. Không mở SSE cho một
 * con số: chuông không cần realtime tới từng giây, và một kết nối sống cho
 * mỗi người đang mở trang là cái giá quá đắt cho việc đó.
 */

const POLL_MS = 60000;

const ICONS: Record<string, React.ElementType> = {
  comment: MessageSquare,
  reply: CornerDownRight,
  post_approved: CheckCircle2,
  post_rejected: XCircle,
};

const TONES: Record<string, string> = {
  comment: 'bg-blue-50 text-primary',
  reply: 'bg-indigo-50 text-indigo-600',
  post_approved: 'bg-emerald-50 text-emerald-600',
  post_rejected: 'bg-red-50 text-danger',
};

export const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authReady = useAuthStore((s) => s.authReady);

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setIsLoading(true);
      const page = await notificationService.list(20);
      setItems(page.items);
      setUnread(page.unread_count);
    } catch {
      // Chuông hỏng thì header vẫn phải dùng được.
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!authReady || !isAuthenticated) return;
    void load();
    const tick = () => {
      if (document.visibilityState === 'visible') void load();
    };
    const timer = window.setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [authReady, isAuthenticated, load]);

  // Bấm ra ngoài thì đóng. Không có cái này thì bảng xổ đứng lì trên màn hình.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  if (!isAuthenticated) return null;

  const handleOpen = () => {
    setOpen((v) => !v);
    if (!open) void load();
  };

  const handleClick = async (item: AppNotification) => {
    setOpen(false);
    if (!item.is_read) {
      // Đánh dấu đọc ngay trên giao diện rồi mới gọi server: người dùng vừa
      // bấm, họ không cần chờ một vòng mạng để thấy chấm xanh biến mất.
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)));
      setUnread((n) => Math.max(0, n - 1));
      void notificationService.markRead(item.id).catch(() => undefined);
    }
    if (item.link) navigate(item.link);
  };

  const handleReadAll = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnread(0);
    void notificationService.markAllRead().catch(() => undefined);
  };

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={handleOpen}
        className="p-2 text-text-secondary hover:text-primary hover:bg-primary/5 rounded-full transition-colors relative"
        title="Thông báo"
        aria-label={unread > 0 ? `${unread} thông báo chưa đọc` : 'Thông báo'}
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[min(360px,calc(100vw-2rem))] bg-white rounded-xl border border-border shadow-xl overflow-hidden z-50">
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border">
            <h3 className="text-[13px] font-bold text-text">Thông báo</h3>
            {unread > 0 && (
              <button
                type="button"
                onClick={handleReadAll}
                className="flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline"
              >
                <CheckCheck size={13} />
                Đánh dấu đã đọc
              </button>
            )}
          </div>

          <div className="max-h-[min(420px,60vh)] overflow-y-auto">
            {isLoading && items.length === 0 ? (
              <div className="py-10 flex justify-center text-text-secondary">
                <Loader2 className="animate-spin" size={20} />
              </div>
            ) : items.length === 0 ? (
              <div className="py-10 px-4 text-center">
                <Bell size={22} className="mx-auto text-slate-300 mb-2" />
                <p className="text-[13px] font-medium text-text">Chưa có thông báo nào</p>
                <p className="text-[12px] text-text-secondary mt-0.5">
                  Có người trả lời bài của bạn thì sẽ hiện ở đây.
                </p>
              </div>
            ) : (
              items.map((item) => {
                const Icon = ICONS[item.type] ?? Bell;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleClick(item)}
                    className={cn(
                      'w-full flex items-start gap-2.5 px-3.5 py-2.5 text-left border-b border-slate-100 last:border-b-0 transition-colors',
                      item.is_read ? 'hover:bg-slate-50' : 'bg-primary/[0.04] hover:bg-primary/[0.08]',
                    )}
                  >
                    {item.actor ? (
                      <img
                        src={getAvatarUrl(item.actor, item.actor.full_name || item.actor.username || 'U')}
                        alt=""
                        className="w-8 h-8 rounded-full object-cover border border-border shrink-0"
                      />
                    ) : (
                      <span
                        className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                          TONES[item.type] ?? 'bg-slate-100 text-slate-500',
                        )}
                      >
                        <Icon size={15} />
                      </span>
                    )}

                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold text-text leading-5">
                        {item.title}
                      </span>
                      {item.body && (
                        <span className="block text-[12px] text-text-secondary truncate mt-0.5">
                          {item.body}
                        </span>
                      )}
                      <span className="block text-[11px] text-slate-400 mt-0.5">
                        {formatRelativeTime(item.created_at)}
                      </span>
                    </span>

                    {!item.is_read && (
                      <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" aria-hidden="true" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
