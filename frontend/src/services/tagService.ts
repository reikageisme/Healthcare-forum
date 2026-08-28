import api from '../lib/api';
import { Tag, TagWithCount } from '../types';

export const tagService = {
  getHotTags: async (limit: number = 10): Promise<TagWithCount[]> => {
    const response = await api.get<TagWithCount[]>('/tags/hot', { params: { limit } });
    return response.data;
  },

  searchTags: async (q: string, limit: number = 20): Promise<Tag[]> => {
    const response = await api.get<Tag[]>('/tags/search', { params: { q, limit } });
    return response.data;
  },

  listTags: async (skip: number = 0, limit: number = 100): Promise<Tag[]> => {
    const response = await api.get<Tag[]>('/tags', { params: { skip, limit } });
    return response.data;
  },

  getTag: async (idOrSlug: string): Promise<TagWithCount> => {
    const response = await api.get<TagWithCount>(`/tags/${idOrSlug}`);
    return response.data;
  },
};
