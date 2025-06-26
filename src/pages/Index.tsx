
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useUser } from '@/contexts/UserContext';
import { useAuth } from '@/contexts/AuthContext';

const Index: React.FC = () => {
  const { user: authUser, loading: authLoading } = useAuth();
  const { user: profileUser, loading: profileLoading } = useUser();

  console.log('Index page - Auth loading:', authLoading, 'Profile loading:', profileLoading);
  console.log('Auth user:', authUser?.email);
  console.log('Profile user:', profileUser);
  console.log('Profile user role:', profileUser?.role);

  // Mostrar loading mientras se obtiene la información
  if (authLoading || profileLoading) {
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
    console.log('No auth user, redirecting to /auth');
    return <Navigate to="/auth" replace />;
  }

  // Si hay usuario autenticado pero no perfil, mostrar mensaje de error y redirigir a auth
  if (authUser && !profileUser) {
    console.error('Auth user exists but no profile user found. This indicates a data integrity issue.');
    console.log('Redirecting to auth for profile recreation...');
    return <Navigate to="/auth" replace />;
  }

  // Validar que el rol del usuario sea válido
  const validRoles = ['admin', 'operator', 'viewer', 'client'];
  if (!validRoles.includes(profileUser.role)) {
    console.error('Invalid user role detected:', profileUser.role);
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center">
          <div className="mb-4">Error: Rol de usuario inválido</div>
          <div className="text-red-400">Contacte al administrador del sistema</div>
        </div>
      </div>
    );
  }

  // Redirigir según el rol del usuario con logging detallado
  console.log('Redirecting user with role:', profileUser.role, 'to appropriate section');
  
  switch (profileUser.role) {
    case 'client':
      console.log('Client user detected, redirecting to /portal');
      return <Navigate to="/portal" replace />;
      
    case 'operator':
      console.log('Operator user detected, redirecting to /operator');
      return <Navigate to="/operator" replace />;
      
    case 'admin':
    case 'viewer':
      console.log('Admin/Viewer user detected, redirecting to /dashboard');
      return <Navigate to="/dashboard" replace />;
      
    default:
      console.error('Unhandled user role:', profileUser.role);
      return <Navigate to="/dashboard" replace />;
  }
};

export default Index;
