
import React from 'react';
import { Navigate } from 'react-router-dom';

const Index: React.FC = () => {
  // Redirigir directamente al dashboard
  return <Navigate to="/dashboard" replace />;
};

export default Index;
