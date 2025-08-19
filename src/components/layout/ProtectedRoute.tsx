
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
  const { user: profileUser, loading: profileLoading, forceRefreshProfile } = useUser();
  const [waitTime, setWaitTime] = React.useState(0);
  const [hasTriedRefresh, setHasTriedRefresh] = React.useState(false);

  console.log('ProtectedRoute - Auth user:', authUser?.email);
  console.log('ProtectedRoute - Profile user role:', profileUser?.role);
  console.log('ProtectedRoute - Required role:', requireRole);
  console.log('ProtectedRoute - Allowed roles:', allowedRoles);
  console.log('ProtectedRoute - Auth loading:', authLoading, 'Profile loading:', profileLoading);

  // Show loading while authenticating
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center">
          <div className="mb-4">Verificando autenticación...</div>
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  // If no authenticated user, redirect to auth
  if (!authUser) {
    console.log('ProtectedRoute - No auth user, redirecting to /auth');
    return <Navigate to="/auth" replace />;
  }

  // Enhanced handling for missing profile with retry logic
  if (!profileUser && !profileLoading) {
    console.error('ProtectedRoute - Auth user exists but no profile found');
    
    // Try to refresh profile once before giving up
    if (!hasTriedRefresh) {
      console.log('ProtectedRoute - Attempting profile refresh...');
      setHasTriedRefresh(true);
      forceRefreshProfile();
      
      return (
        <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
          <div className="text-center">
            <div className="mb-4">Recuperando perfil de usuario...</div>
            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
        </div>
      );
    }
    
    // If refresh failed, wait a bit more before redirecting
    if (waitTime < 3000) {
      console.log(`ProtectedRoute - Waiting for profile (${waitTime}ms)...`);
      setTimeout(() => setWaitTime(waitTime + 1000), 1000);
      
      return (
        <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
          <div className="text-center">
            <div className="mb-4">Cargando perfil de usuario...</div>
            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
            <div className="mt-2 text-sm text-gray-400">
              {Math.ceil((3000 - waitTime) / 1000)}s restantes
            </div>
          </div>
        </div>
      );
    }
    
    // After waiting and retrying, redirect to auth
    console.error('ProtectedRoute - Profile loading failed after retry, redirecting to auth');
    return <Navigate to="/auth" replace />;
  }

  // Show loading while profile is loading
  if (profileLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center">
          <div className="mb-4">Cargando perfil...</div>
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  // If we have auth but still no profile after waiting, allow limited access
  if (authUser && !profileUser) {
    console.warn('ProtectedRoute - Auth user exists but profile unavailable, allowing limited access');
    
    // For critical admin functions, still require profile
    if (requireRole === 'admin' || (allowedRoles && allowedRoles.includes('admin'))) {
      console.error('ProtectedRoute - Admin access requires profile, redirecting to auth');
      return <Navigate to="/auth" replace />;
    }
    
    // For other cases, show a warning but allow access
    return (
      <div className="min-h-screen bg-gray-900">
        <div className="bg-yellow-600 text-white px-4 py-2 text-center text-sm">
          ⚠️ Perfil de usuario no disponible. Funcionalidad limitada.
        </div>
        {children}
      </div>
    );
  }

  // Role checking (same as before but with better logging)
  const effectiveAllowedRoles = allowedRoles || (requireRole ? [requireRole] : []);
  
  if (effectiveAllowedRoles.length === 0) {
    console.log('ProtectedRoute - No role restrictions, access granted');
    return <>{children}</>;
  }

  if (!effectiveAllowedRoles.includes(profileUser.role)) {
    console.warn(`ProtectedRoute - Access denied. User role '${profileUser.role}' not in allowed roles:`, effectiveAllowedRoles);
    
    switch (profileUser.role) {
      case 'client':
        console.log('ProtectedRoute - Redirecting client to /portal');
        return <Navigate to="/portal" replace />;
        
      case 'operator':
        console.log('ProtectedRoute - Redirecting operator to /operator');
        return <Navigate to="/operator" replace />;
        
      case 'admin':
      case 'viewer':
        console.log('ProtectedRoute - Redirecting admin/viewer to /dashboard');
        return <Navigate to="/dashboard" replace />;
        
      default:
        console.error('ProtectedRoute - Unknown role, redirecting to auth');
        return <Navigate to="/auth" replace />;
    }
  }

  console.log('ProtectedRoute - Access granted for role:', profileUser.role);
  return <>{children}</>;
};

export default ProtectedRoute;
