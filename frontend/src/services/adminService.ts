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
    try {
      const response = await api.get<PaginatedResponse<Post>>('/admin/moderation/posts', { params });
      return response.data;
    } catch {
      // Fallback to /admin/posts/pending or /admin/posts
      const response = await api.get<any>('/admin/posts', { params });
      if (Array.isArray(response.data)) {
        return { items: response.data, total: response.data.length };
      }
      return response.data;
    }
  },

  approvePost: async (postId: string): Promise<Post> => {
    try {
      const response = await api.post(`/admin/moderation/posts/${postId}/approve`);
      return response.data.post || response.data;
    } catch {
      const response = await api.put<Post>(`/admin/posts/${postId}/status`, { status: 'approved' });
      return response.data;
    }
  },

  rejectPost: async (postId: string, reason?: string): Promise<Post> => {
    try {
      const response = await api.post(`/admin/moderation/posts/${postId}/reject`, { reason });
      return response.data.post || response.data;
    } catch {
      const response = await api.put<Post>(`/admin/posts/${postId}/status`, { status: 'rejected', reason });
      return response.data;
    }
  },

  getReports: async (params?: {
    status?: string;
    target_type?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Report>> => {
    const response = await api.get<any>('/admin/reports', { params });
    if (Array.isArray(response.data)) {
      return { items: response.data, total: response.data.length };
    }
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
    try {
      const response = await api.patch<Report>(`/admin/reports/${reportId}`, body);
      return response.data;
    } catch {
      const response = await api.put<Report>(`/admin/reports/${reportId}`, body);
      return response.data;
    }
  },

  deleteReportContent: async (reportId: string): Promise<void> => {
    await api.delete(`/admin/reports/${reportId}/content`);
  },

  deleteViolatingContent: async (targetType: string, targetId: string): Promise<void> => {
    const type = targetType.toLowerCase();
    if (type === 'post') {
      await api.delete(`/posts/${targetId}`);
    } else if (type === 'comment') {
      await api.delete(`/comments/${targetId}`);
    }
  },

  getUsers: async (params?: {
    search?: string;
    role?: string;
    is_active?: boolean;
    page?: number;
    limit?: number;
    sort_by?: string;
  }): Promise<PaginatedResponse<User>> => {
    const response = await api.get<any>('/admin/users', { params });
    if (Array.isArray(response.data)) {
      return { items: response.data, total: response.data.length };
    }
    return response.data;
  },

  updateUser: async (userId: string, data: UserAdminUpdateRoleInput): Promise<User> => {
    try {
      const response = await api.patch<User>(`/admin/users/${userId}`, data);
      return response.data;
    } catch {
      const response = await api.put<User>(`/admin/users/${userId}`, data);
      return response.data;
    }
  },

  updateUserRole: async (userId: string, role: UserRole, specialty?: string, bio?: string): Promise<User> => {
    return adminService.updateUser(userId, { role, specialty, bio });
  },

  toggleUserStatus: async (userId: string, isActive: boolean): Promise<User> => {
    return adminService.updateUser(userId, { is_active: isActive });
  },
};

export default adminService;
