import api from '../lib/api';
import { Category } from '../types';

export interface CategoryInput {
  name?: string;
  slug?: string;
  icon?: string | null;
  description?: string | null;
  parent_id?: string | null;
  sort_order?: number;
}

export const categoryService = {
  getCategories: async (): Promise<Category[]> => {
    const response = await api.get<Category[]>('/categories');
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

