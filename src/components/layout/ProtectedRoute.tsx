
import * as React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { Navigate, useLocation } from 'react-router-dom';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user: authUser, loading: authLoading } = useAuth();
  const { user: profileUser, loading: profileLoading } = useUser();
  const location = useLocation();

  // Mostrar loading mientras se inicializa la autenticación o se carga el perfil
  if (authLoading || (authUser && profileLoading)) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center">
          <div className="mb-4">Cargando...</div>
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  // Si no hay usuario autenticado, redirigir a auth
  if (!authUser) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }
  
  // Si hay usuario autenticado pero no hay perfil, redirigir a auth
  if (authUser && !profileUser) {
    console.error("Usuario autenticado sin perfil. Redirigiendo a /auth.");
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Usuario completamente cargado, verificar permisos de rutas
  if (profileUser) {
    const isOperatorPortalRoute = location.pathname === '/operator' || location.pathname.startsWith('/operator/');
    const userRole = profileUser.role;

    // Redirección automática según el rol del usuario
    if (userRole === 'operator' && !isOperatorPortalRoute) {
      return <Navigate to="/operator" replace />;
    }

    if (userRole !== 'operator' && isOperatorPortalRoute) {
      return <Navigate to="/" replace />;
    }

    // Rutas específicas para administradores
    const adminOnlyRoutes = ['/settings'];
    const isAdminOnlyRoute = adminOnlyRoutes.some(route => location.pathname.startsWith(route));

    if (isAdminOnlyRoute && userRole !== 'admin') {
      return <Navigate to="/" replace />;
    }

    // Redireccionamiento automático desde la raíz según el rol
    if (location.pathname === '/' && userRole === 'operator') {
      return <Navigate to="/operator" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
