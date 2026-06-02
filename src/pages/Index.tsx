
import React, { useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useUser } from '@/contexts/UserContext';
import { useAuth } from '@/contexts/AuthContext';
import { debugAuthState } from '@/utils/authUtils';
import { Button } from '@/components/ui/button';
import { AuthBackground } from '@/components/auth/AuthBackground';
import { createLogger } from "@/lib/logger";


const logger = createLogger("Index");
const Index: React.FC = () => {
  const { user: authUser, loading: authLoading } = useAuth();
  const { user: profileUser, loading: profileLoading } = useUser();
  const navigate = useNavigate();

  logger.debug('Index page - Auth loading:', authLoading, 'Profile loading:', profileLoading);
  logger.debug('Index page - Auth user:', authUser?.email);
  logger.debug('Index page - Profile user role:', profileUser?.role);

  // Debug auth state on mount
  useEffect(() => {
    if (!authLoading && !profileLoading) {
      debugAuthState();
    }
  }, [authLoading, profileLoading]);

  // Show loading while getting auth or profile information
  if (authLoading || profileLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center">
          <div className="mb-4">Cargando...</div>
          <div className="size-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  // If no authenticated user, redirect to auth
  if (!authUser) {
    logger.debug('Index - No auth user, redirecting to /auth');
    return <Navigate to="/auth" replace />;
  }

  // If auth user but no profile, still allow redirect based on a fallback
  if (authUser && !profileUser) {
    logger.debug('Index - Auth user exists but no profile, redirecting to dashboard (fallback)');
    return <Navigate to="/dashboard" replace />;
  }

  if (profileUser.role === 'admin' && profileUser.operator_id) {
    return (
      <AuthBackground>
        <div className="w-full rounded-2xl border border-white/15 bg-white/10 p-6 text-white shadow-sm backdrop-blur">
          <div className="space-y-1 text-center">
            <h1 className="text-lg font-semibold">Selecciona un portal</h1>
            <p className="text-sm text-white/70">
              Cuenta: <span className="text-white">{authUser.email}</span>
            </p>
          </div>

          <div className="mt-6 grid gap-3">
            <Button
              onClick={() => {
                navigate('/dashboard', { replace: true });
              }}
            >
              Entrar como Administrador
            </Button>
            <Button
              variant="outline"
              className="border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"
              onClick={() => {
                navigate('/operator', { replace: true });
              }}
            >
              Entrar como Operador
            </Button>
          </div>
        </div>
      </AuthBackground>
    );
  }

  // Redirect based on user role
  logger.debug(`Index - Redirecting user with role: ${profileUser.role}`);
  
  switch (profileUser.role) {
    case 'client':
      logger.debug('Index - Client user detected, redirecting to /portal');
      return <Navigate to="/portal" replace />;
      
    case 'operator':
      logger.debug('Index - Operator user detected, redirecting to /operator');
      return <Navigate to="/operator" replace />;
      
    case 'admin':
    case 'viewer':
      logger.debug('Index - Admin/Viewer user detected, redirecting to /dashboard');
      return <Navigate to="/dashboard" replace />;
      
    default:
      logger.error('Index - Unknown role, redirecting to /dashboard');
      return <Navigate to="/dashboard" replace />;
  }
};

export default Index;
