import api from '../lib/api';
import { AdminStats, PaginatedResponse, Post, Report, User, UserRole, UserAdminUpdateRoleInput } from '../types';

export const adminService = {
  getStats: async (days: number = 30): Promise<AdminStats> => {
    const response = await api.get<AdminStats>('/admin/stats', {
      params: { days },
    });
    return response.data;
  },

  getModerationPosts: async (params?: {
    status?: string;
    search?: string;
    category_id?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Post>> => {
    const response = await api.get<PaginatedResponse<Post>>('/admin/posts', { params });
    return response.data;
  },

  approvePost: async (postId: string): Promise<Post> => {
    const response = await api.post<{ post: Post }>(`/admin/posts/${postId}/approve`);
    return response.data.post;
  },

  rejectPost: async (postId: string, reason?: string): Promise<Post> => {
    const response = await api.post<{ post: Post }>(`/admin/posts/${postId}/reject`, { reason });
    return response.data.post;
  },

  getReports: async (params?: {
    status?: string;
    target_type?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Report>> => {
    const response = await api.get<PaginatedResponse<Report>>('/admin/reports', { params });
    return response.data;
  },

  getModerationPost: async (postId: string): Promise<Post> => {
    const response = await api.get<Post>('/posts/' + postId);
    return response.data;
  },

  resolveReport: async (
    reportId: string,
    payload?: { status?: string; resolution_notes?: string; action?: string }
  ): Promise<Report> => {
    const body = {
      status: payload?.status || 'resolved',
      resolution_notes: payload?.resolution_notes || payload?.action || 'Resolved by admin',
    };
    const response = await api.put<Report>(`/admin/reports/${reportId}`, body);
    return response.data;
  },

  deleteReportContent: async (reportId: string): Promise<void> => {
    await api.delete(`/admin/reports/${reportId}/content`);
  },

  getUsers: async (params?: {
    search?: string;
    role?: string;
    is_active?: boolean;
    page?: number;
    limit?: number;
    sort_by?: string;
  }): Promise<PaginatedResponse<User>> => {
    const response = await api.get<PaginatedResponse<User>>('/admin/users', { params });
    return response.data;
  },

  updateUser: async (userId: string, data: UserAdminUpdateRoleInput): Promise<User> => {
    const response = await api.patch<User>(`/admin/users/${userId}`, data);
    return response.data;
  },

  updateUserRole: async (userId: string, role: UserRole, specialty?: string, bio?: string): Promise<User> => {
    return adminService.updateUser(userId, { role, specialty, bio });
  },

  toggleUserStatus: async (userId: string, isActive: boolean): Promise<User> => {
    return adminService.updateUser(userId, { is_active: isActive });
  },
};

export default adminService;
