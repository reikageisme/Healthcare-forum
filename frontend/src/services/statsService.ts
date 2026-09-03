import api from '../lib/api';

export interface CommunityStats {
  total_members: number;
  total_posts: number;
  total_solved_questions: number;
}

export const statsService = {
  getCommunityStats: async (): Promise<CommunityStats> => {
    const response = await api.get<CommunityStats>('/stats');
    return response.data;
  },
};
