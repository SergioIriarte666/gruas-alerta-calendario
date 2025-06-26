
import * as React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  requireRole?: string;
}

const ProtectedRoute = ({ children, allowedRoles, requireRole }: ProtectedRouteProps) => {
  const { user: authUser, loading: authLoading } = useAuth();
  const { user: profileUser, loading: profileLoading } = useUser();

  console.log('ProtectedRoute - Auth user:', authUser?.email);
  console.log('ProtectedRoute - Profile user role:', profileUser?.role);
  console.log('ProtectedRoute - Required role:', requireRole);
  console.log('ProtectedRoute - Allowed roles:', allowedRoles);

  // Show loading while authenticating
  if (authLoading || profileLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center">
          <div className="mb-4">Verificando permisos...</div>
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  // If no authenticated user, redirect to auth
  if (!authUser) {
    console.log('ProtectedRoute - No auth user, redirecting to /auth');
    return <Navigate to="/auth" replace />;
  }

  // If we have auth user but no profile, something is wrong - redirect to auth
  if (!profileUser) {
    console.error('ProtectedRoute - Auth user exists but no profile found');
    return <Navigate to="/auth" replace />;
  }

  // Determine effective allowed roles
  const effectiveAllowedRoles = allowedRoles || (requireRole ? [requireRole] : []);
  
  // Check role-based access control
  if (effectiveAllowedRoles.length > 0 && !effectiveAllowedRoles.includes(profileUser.role)) {
    console.warn(`ProtectedRoute - Access denied. User role '${profileUser.role}' not in allowed roles:`, effectiveAllowedRoles);
    console.log(`ProtectedRoute - Redirecting user with role '${profileUser.role}' to their appropriate area`);
    
    // For client role specifically trying to access portal but failing
    if (requireRole === 'client' && profileUser.role !== 'client') {
      console.error('ProtectedRoute - User trying to access client portal but is not a client');
      return (
        <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
          <div className="text-center">
            <h2 className="text-xl font-bold mb-4">Acceso Denegado</h2>
            <p className="text-red-400 mb-4">No tienes permisos para acceder al portal de clientes.</p>
            <p className="text-gray-400 text-sm">Tu rol actual: {profileUser.role}</p>
            <p className="text-gray-400 text-sm">Contacta al administrador si crees que esto es un error.</p>
          </div>
        </div>
      );
    }
    
    // Redirect based on user role to prevent unauthorized access
    switch (profileUser.role) {
      case 'client':
        console.log('ProtectedRoute - Redirecting client to /portal');
        return <Navigate to="/portal" replace />;
        
      case 'operator':
        console.log('ProtectedRoute - Redirecting operator to /operator');
        return <Navigate to="/operator" replace />;
        
      case 'admin':
      case 'viewer':
        console.log('ProtectedRoute - Redirecting admin/viewer to /dashboard');
        return <Navigate to="/dashboard" replace />;
        
      default:
        console.error('ProtectedRoute - Unknown role, showing error');
        return (
          <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
            <div className="text-center">
              <h2 className="text-xl font-bold mb-4">Error de Configuración</h2>
              <p className="text-red-400 mb-4">Tu cuenta no tiene un rol válido asignado.</p>
              <p className="text-gray-400 text-sm">Rol actual: {profileUser.role}</p>
              <p className="text-gray-400 text-sm">Contacta al administrador del sistema.</p>
            </div>
          </div>
        );
    }
  }

  console.log('ProtectedRoute - Access granted for role:', profileUser.role);
  return <>{children}</>;
};

export default ProtectedRoute;
