import api from '../lib/api';
import { Category } from '../types';

export interface ForumLastPost {
  id: string;
  title: string;
  created_at: string;
  author_name: string | null;
}

/** Chuyên mục kèm số liệu dạng diễn đàn: số thớt, số trả lời, thớt mới nhất. */
export interface ForumCategory extends Category {
  thread_count: number;
  reply_count: number;
  last_post: ForumLastPost | null;
}

export const forumService = {
  getForumIndex: async (): Promise<ForumCategory[]> => {
    const response = await api.get<ForumCategory[]>('/forum');
    return response.data;
  },
};
