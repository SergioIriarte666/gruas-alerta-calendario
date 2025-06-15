
import React, { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { Navigate, useLocation } from 'react-router-dom';

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user: authUser, loading: authLoading } = useAuth();
  const { user: profileUser } = useUser();
  const location = useLocation();

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div>Cargando...</div>
      </div>
    );
  }

  if (!authUser) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // El UserProvider tiene su propia pantalla de carga, así que si llegamos aquí, el perfil ya debería estar cargado.
  // Verificamos el rol si profileUser existe.
  if (profileUser) {
    const isOperatorRoute = location.pathname.startsWith('/operator');
    const userRole = profileUser.role;

    if (userRole === 'operator' && !isOperatorRoute) {
      // Operador intentando acceder a rutas de no-operador
      return <Navigate to="/operator" replace />;
    }

    if (userRole !== 'operator' && isOperatorRoute) {
      // No-operador intentando acceder a rutas de operador
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
