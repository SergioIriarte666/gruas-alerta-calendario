import { Navigate } from 'react-router-dom';
import { useUser } from '@/contexts/UserContext';

/**
 * Lightweight wrapper for admin-only routes inside the shared Layout.
 * Redirects non-admin users to /dashboard.
 */
const AdminOnlyRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useUser();
  
  if (user && user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
};

export default AdminOnlyRoute;
