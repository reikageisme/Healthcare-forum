import { and, eq, ne } from 'drizzle-orm';
import { db } from '../db/index.js';
import { notifications } from '../db/schema.js';

export type NotificationType =
  | 'comment'
  | 'reply'
  | 'post_approved'
  | 'post_rejected';

interface NotifyInput {
  /** Người nhận. */
  userId: string;
  /** Người gây ra; bỏ trống khi là hệ thống. */
  actorId?: string | null;
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
}

/**
 * Ghi một thông báo.
 *
 * Cố ý nuốt lỗi: thông báo là thứ đi kèm, không phải việc chính. Bình luận đã
 * lưu xong rồi mà lỗi ở đây làm cả request 500 thì người dùng thấy "gửi thất
 * bại" và gửi lại — thành hai bình luận. Hỏng thì ghi log, để yên đó.
 *
 * Không tự báo cho chính mình: trả lời bài của chính mình là chuyện bình
 * thường, và một cái chuông đỏ vì việc mình vừa làm thì vô nghĩa.
 */
export async function notify(input: NotifyInput): Promise<void> {
  if (input.actorId && input.actorId === input.userId) return;
  try {
    await db.insert(notifications).values({
      user_id: input.userId,
      actor_id: input.actorId ?? null,
      type: input.type,
      title: input.title.slice(0, 255),
      body: input.body ? input.body.slice(0, 500) : null,
      link: input.link ? input.link.slice(0, 500) : null,
    });
  } catch (err) {
    console.warn('[notify] could not store notification', err);
  }
}

/** Tên hiện trong thông báo. Bình luận ẩn danh thì không lộ tên người viết. */
export function actorLabel(
  isAnonymous: boolean,
  user: { full_name?: string | null; username?: string | null } | null,
): string {
  if (isAnonymous) return 'Một thành viên ẩn danh';
  return user?.full_name || user?.username || 'Một thành viên';
}

/** Đánh dấu đã đọc toàn bộ thông báo của một người. */
export async function markAllRead(userId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ is_read: true })
    .where(and(eq(notifications.user_id, userId), ne(notifications.is_read, true)));
}
