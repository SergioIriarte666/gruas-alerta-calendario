
import * as React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { Navigate, useLocation } from 'react-router-dom';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
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
    const isOperatorPortalRoute = location.pathname === '/operator' || location.pathname.startsWith('/operator/');
    const userRole = profileUser.role;

    console.log('ProtectedRoute: Role-based routing check - userRole:', userRole, 'path:', location.pathname);

    // Operator auto-redirect
    if (userRole === 'operator' && !isOperatorPortalRoute) {
      console.log('ProtectedRoute: Operator user, redirecting to /operator');
      return <Navigate to="/operator" replace />;
    }

    // Non-operator trying to access operator portal
    if (userRole !== 'operator' && isOperatorPortalRoute) {
      console.log('ProtectedRoute: Non-operator trying to access operator portal, redirecting to /dashboard');
      return <Navigate to="/dashboard" replace />;
    }

    // Admin-only routes
    const adminOnlyRoutes = ['/settings', '/service-types'];
    const isAdminOnlyRoute = adminOnlyRoutes.some(route => location.pathname.startsWith(route));

    if (isAdminOnlyRoute && userRole !== 'admin') {
      console.log('ProtectedRoute: Non-admin trying to access admin route, redirecting to /dashboard');
      return <Navigate to="/dashboard" replace />;
    }

    // Root path redirections
    if (location.pathname === '/') {
      if (userRole === 'operator') {
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
