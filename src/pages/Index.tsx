
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useUser } from '@/contexts/UserContext';

const Index: React.FC = () => {
  const { user, loading } = useUser();

  // Mostrar loading mientras se obtiene la información del usuario
  if (loading) {
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
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Redirigir según el rol del usuario
  if (user.role === 'client') {
    return <Navigate to="/portal" replace />;
  }

  if (user.role === 'operator') {
    return <Navigate to="/operator" replace />;
  }

  // Para admin, viewer
  return <Navigate to="/dashboard" replace />;
};

export default Index;
