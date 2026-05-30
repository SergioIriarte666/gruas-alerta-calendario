
import React, { useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useUser } from '@/contexts/UserContext';
import { useAuth } from '@/contexts/AuthContext';
import { debugAuthState } from '@/utils/authUtils';
import { Button } from '@/components/ui/button';

const Index: React.FC = () => {
  const { user: authUser, loading: authLoading } = useAuth();
  const { user: profileUser, loading: profileLoading } = useUser();
  const navigate = useNavigate();

  console.log('Index page - Auth loading:', authLoading, 'Profile loading:', profileLoading);
  console.log('Index page - Auth user:', authUser?.email);
  console.log('Index page - Profile user role:', profileUser?.role);

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
    console.log('Index - No auth user, redirecting to /auth');
    return <Navigate to="/auth" replace />;
  }

  // If auth user but no profile, still allow redirect based on a fallback
  if (authUser && !profileUser) {
    console.log('Index - Auth user exists but no profile, redirecting to dashboard (fallback)');
    return <Navigate to="/dashboard" replace />;
  }

  if (profileUser.role === 'admin' && profileUser.operator_id) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
          <div className="space-y-1">
            <h1 className="text-lg font-semibold text-foreground">Selecciona un portal</h1>
            <p className="text-sm text-muted-foreground">
              Cuenta: <span className="text-foreground">{authUser.email}</span>
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
              onClick={() => {
                navigate('/operator', { replace: true });
              }}
            >
              Entrar como Operador
            </Button>
          </div>

        </div>
      </div>
    );
  }

  // Redirect based on user role
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
