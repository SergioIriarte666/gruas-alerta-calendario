
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

  // Si hay usuario autenticado pero no perfil, esperar un poco más
  if (authUser && !profileUser) {
    console.log('Auth user exists but no profile user yet, waiting...');
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center">
          <div className="mb-4">Configurando perfil...</div>
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  // Redirigir según el rol del usuario
  console.log('Redirecting user with role:', profileUser.role);
  
  if (profileUser.role === 'client') {
    return <Navigate to="/portal" replace />;
  }

  if (profileUser.role === 'operator') {
    return <Navigate to="/operator" replace />;
  }

  // Para admin, viewer
  return <Navigate to="/dashboard" replace />;
};

export default Index;
