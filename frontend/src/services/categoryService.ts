import api from '../lib/api';
import { SURFACE } from '../lib/siteLinks';
import { Category } from '../types';

export interface CategoryInput {
  name?: string;
  slug?: string;
  icon?: string | null;
  description?: string | null;
  parent_id?: string | null;
  sort_order?: number;
  surface?: 'portal' | 'forum';
}

export const categoryService = {
  /**
   * Cây chuyên mục của trang đang đứng.
   *
   * Trang tin xếp theo chuyên trang toà soạn, diễn đàn chia theo chuyên khoa.
   * Truyền 'all' khi cần cả hai — chỉ trang quản trị mới cần.
   */
  getCategories: async (surface: 'portal' | 'forum' | 'all' = SURFACE): Promise<Category[]> => {
    const response = await api.get<Category[]>('/categories', {
      params: surface === 'all' ? {} : { surface },
    });
    return response.data;
  },

  getCategory: async (idOrSlug: string): Promise<Category> => {
    const response = await api.get<Category>(`/categories/${idOrSlug}`);
    return response.data;
  },

  createCategory: async (data: CategoryInput & { name: string }): Promise<Category> => {
    const response = await api.post<Category>('/categories', data);
    return response.data;
  },

  updateCategory: async (id: string, data: CategoryInput): Promise<Category> => {
    try {
      const response = await api.put<Category>(`/categories/${id}`, data);
      return response.data;
    } catch {
      const response = await api.patch<Category>(`/categories/${id}`, data);
      return response.data;
    }
  },

  deleteCategory: async (id: string): Promise<void> => {
    await api.delete(`/categories/${id}`);
  },
};

