import api from '../lib/api';
import { useAuthStore } from '../stores/authStore';

/**
 * Ends the server session first, then always clears this browser's state.
 * The backend bumps the session generation so tokens open on the sibling
 * domain are rejected on their next request as well.
 */
export async function logoutEverywhere(): Promise<void> {
  try {
    await api.post('/auth/logout');
  } finally {
    useAuthStore.getState().logout();
  }
}
