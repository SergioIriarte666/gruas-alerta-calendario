
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useUser } from '@/contexts/UserContext';
import { useAuth } from '@/contexts/AuthContext';

const Index: React.FC = () => {
  const { user: authUser, loading: authLoading } = useAuth();
  const { user: profileUser, loading: profileLoading } = useUser();

  console.log('Index page - Auth loading:', authLoading, 'Profile loading:', profileLoading);
  console.log('Index page - Auth user:', authUser?.email);
  console.log('Index page - Profile user role:', profileUser?.role);

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
    console.log('Index - No auth user, redirecting to /auth');
    return <Navigate to="/auth" replace />;
  }

  // Si hay usuario autenticado pero no perfil, redirigir a auth
  if (authUser && !profileUser) {
    console.log('Index - Auth user exists but no profile user found, redirecting to /auth');
    return <Navigate to="/auth" replace />;
  }

  // Redirigir según el rol del usuario con la misma lógica simple
  console.log(`Index - Redirecting user with role: ${profileUser.role}`);
  
  switch (profileUser.role) {
    case 'client':
      console.log('Index - Client user detected, redirecting to /portal');
      return <Navigate to="/portal" replace />;
      
    case 'operator':
      console.log('Index - Operator user detected, redirecting to /operator');
      return <Navigate to="/operator" replace />;
      
    case 'admin':
    case 'viewer':
      console.log('Index - Admin/Viewer user detected, redirecting to /dashboard');
      return <Navigate to="/dashboard" replace />;
      
    default:
      console.error('Index - Unknown role, redirecting to /dashboard');
      return <Navigate to="/dashboard" replace />;
  }
};

export default Index;
