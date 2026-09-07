import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

interface AuthenticatedRouteGuardProps {
  children?: React.ReactNode;
}

export const AuthenticatedRouteGuard: React.FC<AuthenticatedRouteGuardProps> = ({ children }) => {
  const { isLoggedIn, user } = useAuth();
  const location = useLocation();

  if (!isLoggedIn() || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};

export default AuthenticatedRouteGuard;
