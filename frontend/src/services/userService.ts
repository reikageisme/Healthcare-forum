import api from '../lib/api';
import { User } from '../types';

export interface ProfileUpdateInput {
  full_name?: string;
  avatar_url?: string;
  specialty?: string;
  workplace?: string;
  bio?: string;
}

export const userService = {
  getUser: async (id: string): Promise<User> => {
    const response = await api.get<User>(`/users/${id}`);
    return response.data;
  },

  updateProfile: async (id: string, data: ProfileUpdateInput): Promise<User> => {
    const response = await api.put<User>(`/users/${id}`, data);
    return response.data;
  },
};
