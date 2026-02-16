import * as React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { Navigate, useLocation } from 'react-router-dom';
import { useUserModulePermissions } from '@/hooks/useUserModulePermissions';
import { getModuleByRoute } from '@/constants/modules';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  requireRole?: string;
  moduleKey?: string;
}

const ProtectedRoute = ({ children, allowedRoles, requireRole, moduleKey }: ProtectedRouteProps) => {
  const { user: authUser, loading: authLoading } = useAuth();
  const { user: profileUser, loading: profileLoading, forceRefreshProfile } = useUser();
  const { hasModuleAccess, loadingCurrentUser } = useUserModulePermissions();
  const location = useLocation();
  const [waitTime, setWaitTime] = React.useState(0);
  const [hasTriedRefresh, setHasTriedRefresh] = React.useState(false);

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

  if (!authUser) {
    return <Navigate to="/auth" replace />;
  }

  if (!profileUser && !profileLoading) {
    if (!hasTriedRefresh) {
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
    
    if (waitTime < 3000) {
      setTimeout(() => setWaitTime(waitTime + 1000), 1000);
      return (
        <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
          <div className="text-center">
            <div className="mb-4">Cargando perfil de usuario...</div>
            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
        </div>
      );
    }
    
    return <Navigate to="/auth" replace />;
  }

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

  if (authUser && !profileUser) {
    if (requireRole === 'admin' || (allowedRoles && allowedRoles.includes('admin'))) {
      return <Navigate to="/auth" replace />;
    }
    return (
      <div className="min-h-screen bg-gray-900">
        <div className="bg-yellow-600 text-white px-4 py-2 text-center text-sm">
          ⚠️ Perfil de usuario no disponible. Funcionalidad limitada.
        </div>
        {children}
      </div>
    );
  }

  const effectiveAllowedRoles = allowedRoles || (requireRole ? [requireRole] : []);
  
  if (effectiveAllowedRoles.length === 0) {
    return <>{children}</>;
  }

  if (!effectiveAllowedRoles.includes(profileUser!.role)) {
    switch (profileUser!.role) {
      case 'client':
        return <Navigate to="/portal" replace />;
      case 'operator':
        return <Navigate to="/operator" replace />;
      case 'admin':
      case 'viewer':
        return <Navigate to="/dashboard" replace />;
      default:
        return <Navigate to="/auth" replace />;
    }
  }

  const effectiveModuleKey = moduleKey || getModuleByRoute(location.pathname)?.key;
  
  if (effectiveModuleKey && !loadingCurrentUser) {
    const hasAccess = hasModuleAccess(effectiveModuleKey);
    if (!hasAccess) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
