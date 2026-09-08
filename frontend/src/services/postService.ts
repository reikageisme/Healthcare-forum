import api from '../lib/api';
import { SURFACE } from '../lib/siteLinks';
import { Post, PostCreateInput, PostUpdateInput, PostCursorPage } from '../types';

export interface GetPostsParams {
  cursor?: string | null;
  limit?: number;
  category?: string;
  tag?: string;
  post_type?: string;
  author_id?: string;
  search?: string;
  sort_by?: 'newest' | 'helpful' | 'comments';
  /**
   * Lấy bài của trang nào. Bỏ trống thì lấy đúng trang đang đứng — đó là thứ
   * khiến medicvn.com và forums.medicvn.com thôi hiện cùng một danh sách.
   * Truyền 'all' khi thật sự cần cả hai (trang quản trị).
   */
  surface?: 'portal' | 'forum' | 'all';
}

export const postService = {
  getPosts: async (params?: GetPostsParams): Promise<PostCursorPage> => {
    const cleanParams: Record<string, any> = {};
    if (params) {
      if (params.cursor) cleanParams.cursor = params.cursor;
      if (params.limit) cleanParams.limit = params.limit;
      if (params.category) cleanParams.category = params.category;
      if (params.tag) cleanParams.tag = params.tag;
      if (params.post_type) cleanParams.post_type = params.post_type;
      if (params.author_id) cleanParams.author_id = params.author_id;
      if (params.search) cleanParams.search = params.search;
      if (params.sort_by) cleanParams.sort_by = params.sort_by;
    }
    const surface = params?.surface ?? SURFACE;
    if (surface !== 'all') cleanParams.surface = surface;
    const response = await api.get<PostCursorPage>('/posts', { params: cleanParams });
    return response.data;
  },

  getPostById: async (idOrSlug: string): Promise<Post> => {
    const response = await api.get<Post>(`/posts/${idOrSlug}`);
    return response.data;
  },

  createPost: async (data: PostCreateInput): Promise<Post> => {
    // Bài sinh ra ở trang nào thì thuộc về trang đó. Backend không đoán được,
    // vì cả hai bản dựng gọi cùng một endpoint.
    const response = await api.post<Post>('/posts', { surface: SURFACE, ...data });
    return response.data;
  },

  updatePost: async (idOrSlug: string, data: PostUpdateInput): Promise<Post> => {
    const response = await api.put<Post>(`/posts/${idOrSlug}`, data);
    return response.data;
  },

  acceptAnswer: async (postId: string, commentId: string | null): Promise<void> => {
    await api.put(`/posts/${postId}/accepted-answer`, { comment_id: commentId });
  },

  deletePost: async (idOrSlug: string): Promise<void> => {
    await api.delete(`/posts/${idOrSlug}`);
  },
};
