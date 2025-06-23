
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useUser } from '@/contexts/UserContext';

const Index: React.FC = () => {
  const { user, loading } = useUser();

  // Mostrar loading mientras se obtiene la información del usuario
  if (loading) {
    return <div className="flex items-center justify-center h-screen">Cargando...</div>;
  }

  // Si no hay usuario autenticado, redirigir a auth
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Redirigir según el rol del usuario
  if (user.role === 'client') {
    return <Navigate to="/portal/dashboard" replace />;
  }

  // Para admin, operator, viewer
  return <Navigate to="/dashboard" replace />;
};

export default Index;
