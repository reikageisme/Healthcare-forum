import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

interface AdminOnlyGuardProps {
  children?: React.ReactNode;
}

export const AdminOnlyGuard: React.FC<AdminOnlyGuardProps> = ({ children }) => {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};

export default AdminOnlyGuard;
