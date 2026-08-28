import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

interface AdminRouteGuardProps {
  children?: React.ReactNode;
}

export const AdminRouteGuard: React.FC<AdminRouteGuardProps> = ({ children }) => {
  const { isAuthenticated, canModerate, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated || !user) {
    return <Navigate to="/" state={{ from: location, message: 'Vui lòng đăng nhập để truy cập.' }} replace />;
  }

  if (!canModerate) {
    return <Navigate to="/" state={{ from: location, message: 'Bạn không có quyền truy cập khu vực Quản trị.' }} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};

export default AdminRouteGuard;
