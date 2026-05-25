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

const LoadingScreen = ({ message }: { message: string }) => (
  <div className="flex items-center justify-center h-screen bg-background text-foreground">
    <div className="text-center">
      <div className="mb-4">{message}</div>
      <div className="size-8 border-2 border-foreground border-t-transparent rounded-full animate-spin mx-auto"></div>
    </div>
  </div>
);

const ProtectedRoute = ({ children, allowedRoles, requireRole, moduleKey }: ProtectedRouteProps) => {
  const { user: authUser, loading: authLoading } = useAuth();
  const { user: profileUser, loading: profileLoading, forceRefreshProfile } = useUser();
  const { hasModuleAccess, loadingCurrentUser } = useUserModulePermissions();
  const location = useLocation();
  const [hasTriedRefresh, setHasTriedRefresh] = React.useState(false);
  const [waitingForProfile, setWaitingForProfile] = React.useState(false);
  const [giveUp, setGiveUp] = React.useState(false);

  // Handle profile refresh in useEffect to avoid setState during render
  React.useEffect(() => {
    if (!authLoading && authUser && !profileUser && !profileLoading && !hasTriedRefresh) {
      setHasTriedRefresh(true);
      setWaitingForProfile(true);
      forceRefreshProfile();
    }
  }, [authLoading, authUser, profileUser, profileLoading, hasTriedRefresh, forceRefreshProfile]);

  // Timeout for waiting
  React.useEffect(() => {
    if (!waitingForProfile) return;
    const timer = setTimeout(() => {
      setGiveUp(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, [waitingForProfile]);

  // Reset waiting when profile arrives
  React.useEffect(() => {
    if (profileUser && waitingForProfile) {
      setWaitingForProfile(false);
    }
  }, [profileUser, waitingForProfile]);

  if (authLoading) {
    return <LoadingScreen message="Verificando autenticación..." />;
  }

  if (!authUser) {
    return <Navigate to="/auth" replace />;
  }

  if (profileLoading || (waitingForProfile && !giveUp)) {
    return <LoadingScreen message="Cargando perfil..." />;
  }

  if (!profileUser && giveUp) {
    return <Navigate to="/auth" replace />;
  }

  if (authUser && !profileUser) {
    if (requireRole === 'admin' || (allowedRoles && allowedRoles.includes('admin'))) {
      return <Navigate to="/auth" replace />;
    }
    return (
      <div className="min-h-screen bg-background">
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
