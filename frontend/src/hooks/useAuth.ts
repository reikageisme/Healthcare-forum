import { useAuthStore } from '../stores/authStore';
import { UserRole } from '../types';

export const useAuth = () => {
  const { user, token, refreshToken, isAuthenticated, setSession, clearSession, logout, setUser } =
    useAuthStore();

  const isLoggedIn = () => isAuthenticated && !!token;

  const hasRole = (role: UserRole) => {
    if (!user || !user.role) return false;
    return user.role.toLowerCase() === role.toLowerCase();
  };

  const role = user?.role ? user.role.toLowerCase() : '';
  const isAdmin = role === 'admin';
  const isModerator = role === 'moderator';
  const isDoctor = role === 'doctor';
  const canModerate = isAdmin || isModerator;

  return {
    user,
    token,
    refreshToken,
    isAuthenticated,
    isLoggedIn,
    hasRole,
    role,
    isAdmin,
    isModerator,
    isDoctor,
    canModerate,
    setSession,
    clearSession,
    logout,
    setUser,
  };
};

export default useAuth;

