
import * as React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { Navigate, useLocation } from 'react-router-dom';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user: authUser, loading: authLoading } = useAuth();
  const { user: profileUser, loading: profileLoading } = useUser();
  const location = useLocation();

  console.log('ProtectedRoute: authLoading:', authLoading, 'profileLoading:', profileLoading, 'authUser:', !!authUser, 'profileUser:', !!profileUser);

  // Mostrar loading mientras se inicializa la autenticación
  if (authLoading) {
    console.log('ProtectedRoute: Showing auth loading...');
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center">
          <div className="mb-4">Cargando autenticación...</div>
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  // Si no hay usuario autenticado, redirigir a auth
  if (!authUser) {
    console.log('ProtectedRoute: No authenticated user, redirecting to /auth');
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }
  
  // Si hay usuario autenticado pero aún se está cargando el perfil, mostrar loading
  if (profileLoading) {
    console.log('ProtectedRoute: Profile loading...');
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center">
          <div className="mb-4">Cargando perfil...</div>
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }
  
  // Si hay usuario autenticado pero no hay perfil después de cargar, redirigir a auth
  if (authUser && !profileUser) {
    console.log('ProtectedRoute: User authenticated but no profile found, redirecting to /auth');
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Usuario completamente cargado, verificar permisos de rutas
  if (profileUser) {
    console.log('ProtectedRoute: User fully loaded, checking permissions...');
    const isOperatorPortalRoute = location.pathname === '/operator' || location.pathname.startsWith('/operator/');
    const userRole = profileUser.role;

    // Redirección automática según el rol del usuario
    if (userRole === 'operator' && !isOperatorPortalRoute) {
      console.log('ProtectedRoute: Operator user, redirecting to /operator');
      return <Navigate to="/operator" replace />;
    }

    if (userRole !== 'operator' && isOperatorPortalRoute) {
      console.log('ProtectedRoute: Non-operator trying to access operator portal, redirecting to /');
      return <Navigate to="/" replace />;
    }

    // Rutas específicas para administradores
    const adminOnlyRoutes = ['/settings'];
    const isAdminOnlyRoute = adminOnlyRoutes.some(route => location.pathname.startsWith(route));

    if (isAdminOnlyRoute && userRole !== 'admin') {
      console.log('ProtectedRoute: Non-admin trying to access admin route, redirecting to /');
      return <Navigate to="/" replace />;
    }

    // Redireccionamiento automático desde la raíz según el rol
    if (location.pathname === '/' && userRole === 'operator') {
      console.log('ProtectedRoute: Operator at root, redirecting to /operator');
      return <Navigate to="/operator" replace />;
    }
  }

  console.log('ProtectedRoute: All checks passed, rendering children');
  return <>{children}</>;
};

export default ProtectedRoute;
