import api from '../lib/api';
import { ReactionCounts, ReactionToggleResponse } from '../types';

export const reactionService = {
  toggleReaction: async (postIdOrSlug: string, reactionType: string): Promise<ReactionToggleResponse> => {
    const response = await api.post<ReactionToggleResponse>(`/posts/${postIdOrSlug}/reactions`, {
      reaction_type: reactionType.toLowerCase(),
    });
    return response.data;
  },

  getReactions: async (postIdOrSlug: string): Promise<{ counts: ReactionCounts; user_reaction: string | null }> => {
    const response = await api.get<{ counts: ReactionCounts; user_reaction: string | null }>(
      `/posts/${postIdOrSlug}/reactions`
    );
    return response.data;
  },
};
