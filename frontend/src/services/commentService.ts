import api from '../lib/api';
import { Comment, CommentCreateInput, CommentUpdateInput } from '../types';

export const commentService = {
  getComments: async (postIdOrSlug: string): Promise<Comment[]> => {
    const response = await api.get<Comment[]>(`/posts/${postIdOrSlug}/comments`);
    return response.data;
  },

  createComment: async (postIdOrSlug: string, data: CommentCreateInput): Promise<Comment> => {
    const response = await api.post<Comment>(`/posts/${postIdOrSlug}/comments`, data);
    return response.data;
  },

  updateComment: async (commentId: string, data: CommentUpdateInput): Promise<Comment> => {
    const response = await api.put<Comment>(`/comments/${commentId}`, data);
    return response.data;
  },

  deleteComment: async (commentId: string): Promise<void> => {
    await api.delete(`/comments/${commentId}`);
  },
};
