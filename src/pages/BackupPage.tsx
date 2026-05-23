import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';

/**
 * Página unificada: toda la gestión de respaldos vive en
 * Configuración → Gestión de Respaldos. Esta ruta se mantiene
 * como atajo retrocompatible y redirige al anchor correcto.
 */
export const BackupPage = () => {
  useEffect(() => {
    // Aseguramos que el hash se aplique tras la navegación
    window.location.hash = 'respaldos';
  }, []);

  return <Navigate to="/settings#respaldos" replace />;
};