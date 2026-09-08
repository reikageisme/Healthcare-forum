import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useAuthStore } from '../../stores/authStore';

interface AdminRouteGuardProps {
  children?: React.ReactNode;
}

export const AdminRouteGuard: React.FC<AdminRouteGuardProps> = ({ children }) => {
  const { isAuthenticated, canModerate, user } = useAuth();
  const authReady = useAuthStore((s) => s.authReady);
  const location = useLocation();

  // Phiên có thể đang được dựng lại từ cookie. Đá người dùng ra trước khi
  // biết họ là ai là cách chắc chắn nhất để một admin đang đăng nhập bị văng
  // khỏi khu quản trị mỗi lần F5.
  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-text-secondary">
        Đang kiểm tra phiên đăng nhập...
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/" state={{ from: location, message: 'Vui lòng đăng nhập để truy cập.' }} replace />;
  }

  if (!canModerate) {
    return <Navigate to="/" state={{ from: location, message: 'Bạn không có quyền truy cập khu vực Quản trị.' }} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};

export default AdminRouteGuard;
