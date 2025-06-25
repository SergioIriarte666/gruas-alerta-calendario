
import * as React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { Navigate, useLocation } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  requireRole?: string;
}

const ProtectedRoute = ({ children, allowedRoles, requireRole }: ProtectedRouteProps) => {
  const { user: authUser, loading: authLoading } = useAuth();
  const { user: profileUser, loading: profileLoading } = useUser();
  const location = useLocation();

  // Combine allowedRoles and requireRole for backward compatibility
  const effectiveAllowedRoles = allowedRoles || (requireRole ? [requireRole] : []);

  // Show loading while authenticating
  if (authLoading || profileLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center">
          <div className="mb-4">Cargando...</div>
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  // If no authenticated user, redirect to auth
  if (!authUser) {
    return <Navigate to="/auth" replace />;
  }

  // If no profile user, redirect to auth (something is wrong)
  if (!profileUser) {
    return <Navigate to="/auth" replace />;
  }

  const userRole = profileUser.role;
  const isClientPortalRoute = location.pathname.startsWith('/portal');
  const isOperatorPortalRoute = location.pathname.startsWith('/operator');

  // Handle role-based routing
  if (userRole === 'client') {
    if (!isClientPortalRoute) {
      return <Navigate to="/portal" replace />;
    }
  } else if (isClientPortalRoute) {
    return <Navigate to="/" replace />;
  }

  // Check specific role requirements
  if (effectiveAllowedRoles.length > 0 && !effectiveAllowedRoles.includes(userRole)) {
    const redirectTo = userRole === 'client' ? '/portal' : '/';
    return <Navigate to={redirectTo} replace />;
  }

  // Handle operator portal access
  if (userRole === 'operator' && isOperatorPortalRoute) {
    // Allow access
  } else if (userRole !== 'operator' && isOperatorPortalRoute) {
    return <Navigate to="/" replace />;
  }

  // Handle root path redirections
  if (location.pathname === '/') {
    if (userRole === 'client') {
      return <Navigate to="/portal" replace />;
    } else if (userRole === 'operator') {
      return <Navigate to="/operator" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
