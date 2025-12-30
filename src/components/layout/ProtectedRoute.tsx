import * as React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { Navigate, useLocation } from 'react-router-dom';
import { useUserModulePermissions } from '@/hooks/useUserModulePermissions';
import { getModuleByRoute } from '@/constants/modules';
import { WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  requireRole?: string;
  moduleKey?: string;
}

// Helper to check if we're truly online
const checkIsOnline = (): boolean => {
  try {
    const forceOffline = localStorage.getItem('tms-force-offline-mode') === 'true';
    return navigator.onLine && !forceOffline;
  } catch {
    return navigator.onLine;
  }
};

const ProtectedRoute = ({ children, allowedRoles, requireRole, moduleKey }: ProtectedRouteProps) => {
  const { user: authUser, loading: authLoading } = useAuth();
  const { user: profileUser, loading: profileLoading, forceRefreshProfile } = useUser();
  const { hasModuleAccess, loadingCurrentUser } = useUserModulePermissions();
  const location = useLocation();
  const [waitTime, setWaitTime] = React.useState(0);
  const [hasTriedRefresh, setHasTriedRefresh] = React.useState(false);
  
  const effectiveIsOnline = checkIsOnline();

  console.log('ProtectedRoute - Auth user:', authUser?.email);
  console.log('ProtectedRoute - Profile user role:', profileUser?.role);
  console.log('ProtectedRoute - Required role:', requireRole);
  console.log('ProtectedRoute - Allowed roles:', allowedRoles);
  console.log('ProtectedRoute - Auth loading:', authLoading, 'Profile loading:', profileLoading);
  console.log('ProtectedRoute - Online:', effectiveIsOnline);

  // Show loading while authenticating
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background text-foreground">
        <div className="text-center">
          <div className="mb-4 text-muted-foreground">Verificando autenticación...</div>
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  // If no authenticated user
  if (!authUser) {
    // If offline and no auth user, show offline message instead of redirecting
    if (!effectiveIsOnline) {
      return (
        <div className="flex items-center justify-center h-screen bg-background text-foreground">
          <div className="text-center max-w-md px-6">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
              <WifiOff className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Sin conexión</h2>
            <p className="text-muted-foreground mb-6">
              No hay conexión a internet y no se encontró una sesión guardada. 
              Conéctate a internet para iniciar sesión.
            </p>
            <Button 
              variant="outline" 
              onClick={() => window.location.reload()}
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Reintentar conexión
            </Button>
          </div>
        </div>
      );
    }
    
    console.log('ProtectedRoute - No auth user, redirecting to /auth');
    return <Navigate to="/auth" replace />;
  }

  // Enhanced handling for missing profile with retry logic
  if (!profileUser && !profileLoading) {
    console.error('ProtectedRoute - Auth user exists but no profile found. Offline:', !effectiveIsOnline);
    
    // If offline and no profile, show offline message
    if (!effectiveIsOnline) {
      return (
        <div className="flex items-center justify-center h-screen bg-background text-foreground">
          <div className="text-center max-w-md px-6">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
              <WifiOff className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Sin conexión</h2>
            <p className="text-muted-foreground mb-6">
              No hay conexión a internet y no se encontró un perfil en caché. 
              Conéctate a internet para acceder al sistema.
            </p>
            <Button 
              variant="outline" 
              onClick={() => window.location.reload()}
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Reintentar conexión
            </Button>
          </div>
        </div>
      );
    }
    
    // Try to refresh profile once before giving up (only when online)
    if (!hasTriedRefresh) {
      console.log('ProtectedRoute - Attempting profile refresh...');
      setHasTriedRefresh(true);
      forceRefreshProfile();
      
      return (
        <div className="flex items-center justify-center h-screen bg-background text-foreground">
          <div className="text-center">
            <div className="mb-4 text-muted-foreground">Recuperando perfil de usuario...</div>
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
        </div>
      );
    }
    
    // If refresh failed, wait a bit more before redirecting
    if (waitTime < 3000) {
      console.log(`ProtectedRoute - Waiting for profile (${waitTime}ms)...`);
      setTimeout(() => setWaitTime(waitTime + 1000), 1000);
      
      return (
        <div className="flex items-center justify-center h-screen bg-background text-foreground">
          <div className="text-center">
            <div className="mb-4 text-muted-foreground">Cargando perfil de usuario...</div>
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
            <div className="mt-2 text-sm text-muted-foreground">
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
      <div className="flex items-center justify-center h-screen bg-background text-foreground">
        <div className="text-center">
          <div className="mb-4 text-muted-foreground">Cargando perfil...</div>
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
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
      <div className="min-h-screen bg-background">
        <div className="bg-yellow-600 text-white px-4 py-2 text-center text-sm">
          ⚠️ Perfil de usuario no disponible. Funcionalidad limitada.
        </div>
        {children}
      </div>
    );
  }

  // Role checking
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

  // Module permission check (after role check passes)
  const effectiveModuleKey = moduleKey || getModuleByRoute(location.pathname)?.key;
  
  if (effectiveModuleKey && !loadingCurrentUser) {
    const hasAccess = hasModuleAccess(effectiveModuleKey);
    console.log('ProtectedRoute - Module access check:', effectiveModuleKey, hasAccess);
    
    if (!hasAccess) {
      console.warn(`ProtectedRoute - Module access denied for '${effectiveModuleKey}', redirecting to dashboard`);
      return <Navigate to="/dashboard" replace />;
    }
  }

  console.log('ProtectedRoute - Access granted for role:', profileUser.role);
  return <>{children}</>;
};

export default ProtectedRoute;
