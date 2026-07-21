
import React, { useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useUser } from '@/contexts/UserContext';
import { useAuth } from '@/contexts/AuthContext';
import { debugAuthState } from '@/utils/authUtils';
import { Button } from '@/components/ui/button';
import { AuthBackground } from '@/components/auth/AuthBackground';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, BriefcaseBusiness, HardHat, LogOut, Sparkles } from 'lucide-react';
import { createLogger } from "@/lib/logger";
import { isOperatorMobileVariant } from '@/lib/appVariant';


const logger = createLogger("Index");
const Index: React.FC = () => {
  const { user: authUser, loading: authLoading, signOut } = useAuth();
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
      <div className="flex h-screen items-center justify-center bg-auth-background text-auth-foreground">
        <div className="text-center">
          <div className="mb-4">Cargando...</div>
          <div className="mx-auto size-8 animate-spin rounded-full border-2 border-auth-foreground border-t-transparent"></div>
        </div>
      </div>
    );
  }

  // If no authenticated user, redirect to auth
  if (!authUser) {
    logger.debug('Index - No auth user, redirecting to /auth');
    return <Navigate to="/auth" replace />;
  }

  // If auth user but no profile, force the safe onboarding path
  if (authUser && !profileUser) {
    logger.debug('Index - Auth user exists but no profile, redirecting to /register');
    return <Navigate to="/register" replace />;
  }

  if (isOperatorMobileVariant()) {
    if (profileUser.role === 'operator') {
      return <Navigate to="/operator" replace />;
    }

    if (profileUser.role === 'admin' && profileUser.operator_id) {
      return <Navigate to="/operator" replace />;
    }

    return (
      <AuthBackground>
        <div className="w-full rounded-3xl border border-auth-border/20 bg-auth-background/60 p-6 text-auth-foreground shadow-2xl backdrop-blur-2xl sm:p-7">
          <div className="space-y-4 text-center">
            <Badge
              variant="outline"
              className="border-auth-border/20 bg-auth-surface/10 px-3 py-1 text-auth-foreground/90 shadow-sm"
            >
              <HardHat className="mr-1 size-3.5" />
              App operador
            </Badge>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight text-auth-foreground drop-shadow-sm">
                Esta app móvil está enfocada en operadores
              </h1>
              <p className="text-sm leading-6 text-auth-muted drop-shadow-sm">
                Para gestión administrativa sigue usando la versión web del TMS. Aquí dejaremos el flujo móvil centrado en servicios, inspecciones y ubicación.
              </p>
            </div>
            <div className="rounded-2xl border border-auth-border/10 bg-auth-background/40 px-4 py-3 text-left shadow-inner">
              <p className="text-xs uppercase tracking-widest text-auth-muted/70">
                Cuenta activa
              </p>
              <p className="mt-1 truncate text-sm font-medium text-auth-foreground">
                {authUser.email}
              </p>
            </div>
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => {
                  void signOut();
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-auth-border/20 bg-auth-surface/10 px-4 py-2 text-sm font-medium text-auth-foreground/90 transition-colors hover:bg-auth-surface/20"
              >
                <LogOut className="size-4" />
                Salir
              </button>
            </div>
          </div>
        </div>
      </AuthBackground>
    );
  }

  if (profileUser.role === 'admin' && profileUser.operator_id) {
    return (
      <AuthBackground>
        <div className="w-full rounded-3xl border border-auth-border/20 bg-auth-background/60 p-6 text-auth-foreground shadow-2xl backdrop-blur-2xl sm:p-7">
          <div className="space-y-4 text-center">
            <Badge
              variant="outline"
              className="border-auth-border/20 bg-auth-surface/10 px-3 py-1 text-auth-foreground/90 shadow-sm"
            >
              <Sparkles className="mr-1 size-3.5" />
              Acceso multiple
            </Badge>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight text-auth-foreground drop-shadow-sm">
                Selecciona un portal
              </h1>
              <p className="text-sm leading-6 text-auth-muted drop-shadow-sm">
                Tu cuenta tiene acceso administrativo y operativo. Elige el entorno con el que quieres continuar.
              </p>
            </div>
            <div className="rounded-2xl border border-auth-border/10 bg-auth-background/40 px-4 py-3 text-left shadow-inner">
              <p className="text-xs uppercase tracking-widest text-auth-muted/70">
                Cuenta activa
              </p>
              <p className="mt-1 truncate text-sm font-medium text-auth-foreground">
                {authUser.email}
              </p>
            </div>
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => {
                  void signOut();
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-auth-border/20 bg-auth-surface/10 px-4 py-2 text-sm font-medium text-auth-foreground/90 transition-colors hover:bg-auth-surface/20"
              >
                <LogOut className="size-4" />
                Salir
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-3">
            <Button
              className="grid h-auto min-h-[4.75rem] w-full max-w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 overflow-hidden rounded-2xl bg-primary px-5 py-4 text-left text-primary-foreground shadow-glow-primary transition-all hover:-translate-y-0.5 hover:bg-primary/95"
              onClick={() => {
                navigate('/dashboard', { replace: true });
              }}
            >
              <span className="flex min-w-0 max-w-full items-center gap-3 overflow-hidden">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-primary-foreground/20 text-primary-foreground">
                  <BriefcaseBusiness className="size-5" />
                </span>
                <span className="min-w-0 max-w-full space-y-1 overflow-hidden">
                  <span className="block truncate text-base font-semibold text-primary-foreground drop-shadow-sm">
                    Entrar como Administrador
                  </span>
                  <span className="block truncate text-sm text-primary-foreground/90">
                    Gestion de servicios, finanzas y configuracion
                  </span>
                </span>
              </span>
              <ArrowRight className="size-5 shrink-0 text-primary-foreground" />
            </Button>
            <button
              type="button"
              className="grid h-auto min-h-[4.75rem] w-full max-w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 overflow-hidden rounded-2xl border border-auth-border/20 bg-auth-background/50 px-5 py-4 text-left text-auth-foreground shadow-inner transition-all hover:-translate-y-0.5 hover:bg-auth-background/60"
              onClick={() => {
                navigate('/operator', { replace: true });
              }}
            >
              <span className="flex min-w-0 max-w-full items-center gap-3 overflow-hidden">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-auth-surface/10 text-auth-foreground/90">
                  <HardHat className="size-5" />
                </span>
                <span className="min-w-0 max-w-full space-y-1 overflow-hidden">
                  <span className="block text-base font-semibold text-auth-foreground drop-shadow-sm">
                    Entrar como Operador
                  </span>
                  <span className="block truncate text-sm text-auth-muted">
                    Portal operativo para terreno, tareas e inspecciones
                  </span>
                </span>
              </span>
              <ArrowRight className="size-5 shrink-0 text-auth-foreground" />
            </button>
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
      logger.error('Index - Unknown role, redirecting to /auth');
      return <Navigate to="/auth" replace />;
  }
};

export default Index;
