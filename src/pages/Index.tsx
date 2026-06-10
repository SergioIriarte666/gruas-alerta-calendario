
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

  // If auth user but no profile, force the safe onboarding path
  if (authUser && !profileUser) {
    logger.debug('Index - Auth user exists but no profile, redirecting to /register');
    return <Navigate to="/register" replace />;
  }

  if (profileUser.role === 'admin' && profileUser.operator_id) {
    return (
      <AuthBackground>
        <div
          className="w-full rounded-[28px] border border-white/15 bg-[linear-gradient(180deg,rgba(18,24,38,0.58),rgba(18,24,38,0.42))] p-6 shadow-[0_24px_60px_rgba(15,23,42,0.28)] backdrop-blur-2xl sm:p-7"
          style={{ color: 'rgba(255,255,255,0.96)' }}
        >
          <div className="space-y-4 text-center">
            <Badge
              variant="outline"
              className="border-white/15 bg-white/10 px-3 py-1 shadow-sm"
              style={{ color: 'rgba(255,255,255,0.92)' }}
            >
              <Sparkles className="mr-1 size-3.5" />
              Acceso multiple
            </Badge>
            <div className="space-y-2">
              <h1
                className="text-2xl font-semibold tracking-tight drop-shadow-[0_1px_10px_rgba(15,23,42,0.35)]"
                style={{ color: 'rgba(255,255,255,0.98)' }}
              >
                Selecciona un portal
              </h1>
              <p
                className="text-sm leading-6 drop-shadow-[0_1px_8px_rgba(15,23,42,0.28)]"
                style={{ color: 'rgba(255,255,255,0.9)' }}
              >
                Tu cuenta tiene acceso administrativo y operativo. Elige el entorno con el que quieres continuar.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/36 px-4 py-3 text-left shadow-inner">
              <p
                className="text-[11px] uppercase tracking-[0.22em]"
                style={{ color: 'rgba(255,255,255,0.62)' }}
              >
                Cuenta activa
              </p>
              <p
                className="mt-1 truncate text-sm font-medium"
                style={{ color: 'rgba(255,255,255,0.98)' }}
              >
                {authUser.email}
              </p>
            </div>
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => {
                  void signOut();
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/6 px-4 py-2 text-sm font-medium transition-colors hover:bg-white/10"
                style={{ color: 'rgba(255,255,255,0.9)' }}
              >
                <LogOut className="size-4" />
                Salir
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-3">
            <Button
              className="grid h-auto min-h-[76px] w-full max-w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 overflow-hidden rounded-2xl bg-primary px-5 py-4 text-left text-primary-foreground shadow-[0_18px_34px_hsl(var(--primary)/0.22)] transition-all hover:-translate-y-0.5 hover:bg-primary/95"
              style={{ color: 'rgba(255,255,255,0.98)' }}
              onClick={() => {
                navigate('/dashboard', { replace: true });
              }}
            >
              <span className="flex min-w-0 max-w-full items-center gap-3 overflow-hidden">
                <span
                  className="flex size-11 items-center justify-center rounded-2xl bg-white/14"
                  style={{ color: 'rgba(255,255,255,0.98)' }}
                >
                  <BriefcaseBusiness className="size-5" />
                </span>
                <span className="min-w-0 max-w-full space-y-1 overflow-hidden">
                  <span
                    className="block truncate text-base font-semibold drop-shadow-[0_1px_6px_rgba(15,23,42,0.24)]"
                    style={{ color: 'rgba(255,255,255,0.98)' }}
                  >
                    Entrar como Administrador
                  </span>
                  <span
                    className="block truncate text-sm"
                    style={{ color: 'rgba(255,255,255,0.94)' }}
                  >
                    Gestion de servicios, finanzas y configuracion
                  </span>
                </span>
              </span>
              <ArrowRight className="size-5 shrink-0" style={{ color: 'rgba(255,255,255,0.98)' }} />
            </Button>
            <button
              type="button"
              className="grid h-auto min-h-[76px] w-full max-w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 overflow-hidden rounded-2xl border border-white/15 bg-slate-950/44 px-5 py-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-all hover:-translate-y-0.5 hover:bg-slate-900/56"
              style={{ color: 'rgba(255,255,255,0.98)' }}
              onClick={() => {
                navigate('/operator', { replace: true });
              }}
            >
              <span className="flex min-w-0 max-w-full items-center gap-3 overflow-hidden">
                <span
                  className="flex size-11 items-center justify-center rounded-2xl bg-white/10"
                  style={{ color: 'rgba(255,255,255,0.92)' }}
                >
                  <HardHat className="size-5" />
                </span>
                <span className="min-w-0 max-w-full space-y-1 overflow-hidden">
                  <span
                    className="block text-base font-semibold drop-shadow-[0_1px_6px_rgba(15,23,42,0.32)]"
                    style={{ color: 'rgba(255,255,255,0.98)' }}
                  >
                    Entrar como Operador
                  </span>
                  <span
                    className="block truncate text-sm"
                    style={{ color: 'rgba(255,255,255,0.9)' }}
                  >
                    Portal operativo para terreno, tareas e inspecciones
                  </span>
                </span>
              </span>
              <ArrowRight className="size-5 shrink-0" style={{ color: 'rgba(255,255,255,0.98)' }} />
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
