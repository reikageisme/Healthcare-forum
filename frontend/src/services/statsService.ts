import api from '../lib/api';
import { User } from '../types';

export interface CommunityStats {
  total_members: number;
  total_posts: number;
  total_solved_questions: number;
}

/** Bác sĩ đã xác thực, kèm số bài đã duyệt — dùng cho ô "Bác sĩ nổi bật". */
export interface FeaturedDoctor extends User {
  post_count: number;
}

export const statsService = {
  getCommunityStats: async (): Promise<CommunityStats> => {
    const response = await api.get<CommunityStats>('/stats');
    return response.data;
  },

  getFeaturedDoctors: async (limit = 3): Promise<FeaturedDoctor[]> => {
    const response = await api.get<FeaturedDoctor[]>('/doctors/featured', { params: { limit } });
    return response.data;
  },
};
