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

const getOfflineCachedRole = (): string | null => {
  try {
    const raw = localStorage.getItem('offline-user-profile-cache-v1');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { profile?: { role?: string } };
    return parsed.profile?.role || null;
  } catch {
    return null;
  }
};

const ProtectedRoute = ({ children, allowedRoles, requireRole, moduleKey }: ProtectedRouteProps) => {
  const { user: authUser, loading: authLoading } = useAuth();
  const { user: profileUser, loading: profileLoading, forceRefreshProfile } = useUser();
  const { hasModuleAccess, loadingCurrentUser } = useUserModulePermissions();
  const location = useLocation();
  const [hasTriedRefresh, setHasTriedRefresh] = React.useState(false);
  const [waitingForProfile, setWaitingForProfile] = React.useState(false);
  const [giveUp, setGiveUp] = React.useState(false);
  const [hasSyncedClientProfile, setHasSyncedClientProfile] = React.useState(false);

  // Handle profile refresh in useEffect to avoid setState during render
  React.useEffect(() => {
    if (!authLoading && authUser && !profileUser && !profileLoading && !hasTriedRefresh) {
      setHasTriedRefresh(true);
      setWaitingForProfile(true);
      forceRefreshProfile();
    }
  }, [authLoading, authUser, profileUser, profileLoading, hasTriedRefresh, forceRefreshProfile]);

  React.useEffect(() => {
    if (requireRole === 'client' && authUser && profileUser && !hasSyncedClientProfile) {
      setHasSyncedClientProfile(true);
      forceRefreshProfile();
    }
  }, [requireRole, authUser, profileUser, hasSyncedClientProfile, forceRefreshProfile]);

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
    const cachedRole = !navigator.onLine ? getOfflineCachedRole() : null;
    if (!navigator.onLine && cachedRole && effectiveAllowedRolesIncludes(allowedRoles, requireRole, cachedRole)) {
      return <>{children}</>;
    }
    return <Navigate to="/auth" replace />;
  }

  if (profileLoading || (waitingForProfile && !giveUp)) {
    return <LoadingScreen message="Cargando perfil..." />;
  }

  if (!profileUser && giveUp) {
    return <Navigate to="/register" replace />;
  }

  if (authUser && !profileUser) {
    return <Navigate to="/register" replace />;
  }

  const effectiveAllowedRoles = allowedRoles || (requireRole ? [requireRole] : []);
  
  if (effectiveAllowedRoles.length === 0) {
    return <>{children}</>;
  }

  if (requireRole === 'client' && profileUser?.role === 'client' && !profileUser.client_id) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
        <div className="w-full max-w-lg rounded-2xl border border-yellow-500/20 bg-card p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-foreground">Acceso pendiente de vinculacion</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Tu cuenta cliente aun no tiene una empresa asociada. Solicita a un administrador que te vincule a un cliente para habilitar el portal.
          </p>
        </div>
      </div>
    );
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

const effectiveAllowedRolesIncludes = (
  allowedRoles: string[] | undefined,
  requireRole: string | undefined,
  role: string,
) => {
  const effectiveAllowedRoles = allowedRoles || (requireRole ? [requireRole] : []);
  return effectiveAllowedRoles.includes(role);
};

export default ProtectedRoute;
