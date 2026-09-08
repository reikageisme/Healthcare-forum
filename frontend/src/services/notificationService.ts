import api from '../lib/api';
import { AppNotification } from '../types';

export interface NotificationPage {
  items: AppNotification[];
  unread_count: number;
}

export const notificationService = {
  /** Danh sách kèm số chưa đọc — chuông cần con số, bảng xổ cần danh sách. */
  list: async (limit = 20): Promise<NotificationPage> => {
    const res = await api.get<NotificationPage>('/notifications', { params: { limit } });
    return res.data;
  },

  markRead: async (id: string): Promise<void> => {
    await api.post(`/notifications/${id}/read`);
  },

  markAllRead: async (): Promise<void> => {
    await api.post('/notifications/read-all');
  },
};

export default notificationService;
