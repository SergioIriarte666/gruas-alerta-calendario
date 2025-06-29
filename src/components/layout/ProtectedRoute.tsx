
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

  // Simplificar la verificación de roles - igual que funciona para admin
  const effectiveAllowedRoles = allowedRoles || (requireRole ? [requireRole] : []);
  
  // Si no hay restricciones de rol, permitir acceso
  if (effectiveAllowedRoles.length === 0) {
    console.log('ProtectedRoute - No role restrictions, access granted');
    return <>{children}</>;
  }

  // Verificar si el usuario tiene el rol requerido
  if (!effectiveAllowedRoles.includes(profileUser.role)) {
    console.warn(`ProtectedRoute - Access denied. User role '${profileUser.role}' not in allowed roles:`, effectiveAllowedRoles);
    
    // Redirigir según el rol del usuario a su área apropiada
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
        console.error('ProtectedRoute - Unknown role, redirecting to auth');
        return <Navigate to="/auth" replace />;
    }
  }

  console.log('ProtectedRoute - Access granted for role:', profileUser.role);
  return <>{children}</>;
};

export default ProtectedRoute;
