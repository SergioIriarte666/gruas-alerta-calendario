
import * as React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  requireRole?: string;
}

const ProtectedRoute = ({ children, allowedRoles, requireRole }: ProtectedRouteProps) => {
  const { user: authUser, loading: authLoading } = useAuth();
  const { user: profileUser, loading: profileLoading } = useUser();

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

  // If we have auth user but no profile, something is wrong - redirect to auth
  if (!profileUser) {
    return <Navigate to="/auth" replace />;
  }

  // Simple role-based access control
  const effectiveAllowedRoles = allowedRoles || (requireRole ? [requireRole] : []);
  
  if (effectiveAllowedRoles.length > 0 && !effectiveAllowedRoles.includes(profileUser.role)) {
    // Redirect based on user role
    if (profileUser.role === 'client') {
      return <Navigate to="/portal" replace />;
    } else {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
