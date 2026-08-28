import api from '../lib/api';
import { BookmarkToggleResponse, PostCursorPage } from '../types';

export const bookmarkService = {
  toggleBookmark: async (postIdOrSlug: string): Promise<BookmarkToggleResponse> => {
    const response = await api.post<BookmarkToggleResponse>(`/posts/${postIdOrSlug}/bookmark`);
    return response.data;
  },

  getBookmarks: async (cursor?: string | null, limit: number = 10): Promise<PostCursorPage> => {
    const params: Record<string, any> = { limit };
    if (cursor) params.cursor = cursor;
    const response = await api.get<PostCursorPage>('/users/me/bookmarks', { params });
    return response.data;
  },
};
