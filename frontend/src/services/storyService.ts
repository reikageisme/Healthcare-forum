import api from '../lib/api';
import { Story, StoryGroup } from '../types';

export const storyService = {
  getStories: async (): Promise<StoryGroup[]> => {
    const response = await api.get<{ items: StoryGroup[] }>('/stories');
    return response.data.items || [];
  },

  createStory: async (data: { image_url: string; caption?: string | null }): Promise<Story> => {
    const response = await api.post<Story>('/stories', data);
    return response.data;
  },

  deleteStory: async (id: string): Promise<void> => {
    await api.delete(`/stories/${id}`);
  },
};
