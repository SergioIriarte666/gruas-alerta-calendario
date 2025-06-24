
import * as React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { Navigate, useLocation } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { user: authUser, loading: authLoading } = useAuth();
  const { user: profileUser, loading: profileLoading, error, retryFetchProfile } = useUser();
  const location = useLocation();

  console.log('ProtectedRoute:', {
    authLoading,
    profileLoading,
    hasAuthUser: !!authUser,
    hasProfileUser: !!profileUser,
    userRole: profileUser?.role,
    currentPath: location.pathname,
    allowedRoles,
    error
  });

  // Show loading while auth is initializing
  if (authLoading) {
    console.log('ProtectedRoute: Auth loading...');
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center">
          <div className="mb-4">Inicializando autenticación...</div>
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  // If no authenticated user, redirect to auth
  if (!authUser) {
    console.log('ProtectedRoute: No authenticated user, redirecting to /auth');
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }
  
  // Show loading while profile is loading - EVITA REDIRECCIONES PREMATURAS
  if (authUser && profileLoading) {
    console.log('ProtectedRoute: Profile loading, showing spinner...');
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center">
          <div className="mb-4">Cargando perfil de usuario...</div>
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }
  
  // If there's an error loading profile, show error message with retry
  if (error) {
    console.error('ProtectedRoute: Profile error:', error);
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-semibold mb-4">Error al cargar perfil</h2>
          <p className="text-gray-400 mb-4">{error}</p>
          <div className="space-x-2">
            <button 
              onClick={retryFetchProfile} 
              className="px-4 py-2 bg-tms-green text-white rounded hover:bg-tms-green-dark"
            >
              Reintentar
            </button>
            <button 
              onClick={() => window.location.href = '/auth'} 
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Volver a Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If authenticated but no profile found after loading, show error
  if (authUser && !profileLoading && !profileUser) {
    console.error('ProtectedRoute: Perfil no encontrado después de autenticación para usuario:', authUser.id);
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-semibold mb-4">Error de Perfil</h2>
          <p className="text-gray-400 mb-4">No se pudo cargar tu perfil de usuario.</p>
          <p className="text-gray-500 text-sm mb-4">Usuario ID: {authUser.id}</p>
          <div className="space-x-2">
            <button 
              onClick={retryFetchProfile} 
              className="px-4 py-2 bg-tms-green text-white rounded hover:bg-tms-green-dark"
            >
              Reintentar
            </button>
            <button 
              onClick={() => window.location.href = '/auth'} 
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Volver a Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Handle role-based routing
  if (profileUser) {
    const userRole = profileUser.role;
    const isClientPortalRoute = location.pathname.startsWith('/portal');
    const isOperatorPortalRoute = location.pathname.startsWith('/operator');

    // --- Portal Segregation ---
    // 1. If user is a client, they MUST be in the client portal.
    if (userRole === 'client') {
      if (!isClientPortalRoute) {
        console.log(`CLIENT '${userRole}' on non-portal route '${location.pathname}'. Redirecting to /portal/dashboard.`);
        return <Navigate to="/portal/dashboard" replace />;
      }
    }
    // 2. If user is NOT a client, they MUST NOT be in the client portal.
    else if (isClientPortalRoute) {
        console.log(`NON-CLIENT '${userRole}' on client portal route '${location.pathname}'. Redirecting to /dashboard.`);
        return <Navigate to="/dashboard" replace />;
    }

    // Role check for specific routes within a portal (e.g. admin-only pages)
    if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
      console.log(`ProtectedRoute: Role '${userRole}' not in allowed roles [${allowedRoles.join(', ')}]. Redirecting.`);
      const redirectTo = userRole === 'client' ? '/portal/dashboard' : '/dashboard';
      return <Navigate to={redirectTo} replace />;
    }
    
    console.log('ProtectedRoute: Role-based routing check - userRole:', userRole, 'path:', location.pathname);

    // ALLOW operators to access their portal BUT NOT redirect them from admin pages
    if (userRole === 'operator' && isOperatorPortalRoute) {
      console.log('ProtectedRoute: Operator accessing operator portal - allowed');
      // Don't redirect, allow access
    }
    
    // Non-operator trying to access operator portal - redirect them
    if (userRole !== 'operator' && isOperatorPortalRoute) {
      console.log('ProtectedRoute: Non-operator trying to access operator portal, redirecting to /dashboard');
      return <Navigate to="/dashboard" replace />;
    }

    // Admin-only routes - FIXED: Only restrict non-admins
    const adminOnlyRoutes = ['/settings', '/service-types'];
    const isAdminOnlyRoute = adminOnlyRoutes.some(route => location.pathname.startsWith(route));

    if (isAdminOnlyRoute && userRole !== 'admin') {
      console.log('ProtectedRoute: Non-admin trying to access admin route, redirecting to /dashboard');
      return <Navigate to="/dashboard" replace />;
    }

    // Root path redirections
    if (location.pathname === '/') {
      if (userRole === 'client') {
        return <Navigate to="/portal/dashboard" replace />;
      } else if (userRole === 'operator') {
        return <Navigate to="/operator" replace />;
      } else {
        return <Navigate to="/dashboard" replace />;
      }
    }
  }

  console.log('ProtectedRoute: All checks passed, rendering children');
  return <>{children}</>;
};

export default ProtectedRoute;
