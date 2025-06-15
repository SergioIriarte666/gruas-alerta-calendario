
import * as React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { Navigate, useLocation } from 'react-router-dom';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user: authUser } = useAuth();
  const { user: profileUser } = useUser();
  const location = useLocation();

  if (!authUser) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }
  
  if (authUser && !profileUser) {
    console.error("Authenticated user found without a profile. Redirecting to /auth.");
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (profileUser) {
    // Verificar rutas específicas del portal de operadores (no gestión de operadores)
    const isOperatorPortalRoute = location.pathname === '/operator' || location.pathname.startsWith('/operator/');
    const userRole = profileUser.role;

    // Redirección automática según el rol del usuario
    if (userRole === 'operator' && !isOperatorPortalRoute) {
      // Operador intentando acceder a rutas no-operador, redirigir a portal operador
      return <Navigate to="/operator" replace />;
    }

    if (userRole !== 'operator' && isOperatorPortalRoute) {
      // No-operador intentando acceder al portal de operador, redirigir a dashboard principal
      return <Navigate to="/" replace />;
    }

    // Rutas específicas para administradores
    const adminOnlyRoutes = ['/settings'];
    const isAdminOnlyRoute = adminOnlyRoutes.some(route => location.pathname.startsWith(route));

    if (isAdminOnlyRoute && userRole !== 'admin') {
      // No-admin intentando acceder a rutas de admin
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
