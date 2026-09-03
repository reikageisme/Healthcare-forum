import api from '../lib/api';
import { Category } from '../types';

export interface ForumLastPost {
  id: string;
  title: string;
  created_at: string;
  author_name: string | null;
}

/** Chuyên mục kèm số liệu dạng diễn đàn: số thớt, số trả lời, thớt mới nhất. */
export interface ForumCategory extends Category {
  thread_count: number;
  reply_count: number;
  last_post: ForumLastPost | null;
}

export const forumService = {
  getForumIndex: async (): Promise<ForumCategory[]> => {
    const response = await api.get<ForumCategory[]>('/forum');
    return response.data;
  },
};

export interface NetworkSite {
  name: string;
  url: string;
  description?: string;
  /** Ảnh đại diện admin tải lên; trống thì client tự thử /favicon.ico. */
  icon_url?: string;
  is_current: boolean;
}

export interface FooterLink {
  name: string;
  url: string;
}

export interface NetworkInfo {
  name: string;
  tagline: string;
  sites: NetworkSite[];
  footer_links: FooterLink[];
  contact_email: string;
}

export const networkService = {
  getNetwork: async (): Promise<NetworkInfo> => {
    const response = await api.get<NetworkInfo>('/network');
    return response.data;
  },
};

export interface NetworkConfigInput {
  name: string;
  tagline: string;
  sites: { name: string; url: string; description?: string; icon_url?: string }[];
  footer_links: { name: string; url: string }[];
  contact_email: string;
}

export const adminNetworkService = {
  get: async (): Promise<NetworkConfigInput> => {
    const response = await api.get<NetworkConfigInput>('/admin/network');
    return response.data;
  },

  save: async (data: NetworkConfigInput): Promise<NetworkConfigInput> => {
    const response = await api.put<NetworkConfigInput>('/admin/network', data);
    return response.data;
  },
};
