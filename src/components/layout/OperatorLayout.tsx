import React, { Suspense } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { RefreshCw, LogOut, Truck, UserRound } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/components/ui/custom-toast';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { OperatorBottomNav } from '@/components/operator/OperatorBottomNav';
import { useAuth } from '@/contexts/AuthContext';
import { useOperatorOfflineSync } from '@/hooks/useOperatorOfflineSync';
import { ThemeSelector } from '@/components/layout/ThemeSelector';
import { OperatorActivityProvider } from '@/contexts/OperatorActivityContext';
import { OperatorTransmissionProvider } from '@/contexts/OperatorTransmissionContext';

export const OperatorLayout = () => {
  const { user } = useUser();
  const { signOut } = useAuth();
  const { toast } = useToast();
  const { pathname } = useLocation();
  useOperatorOfflineSync();
  const isInspection = pathname.includes('/inspection');

  const { data: companyData } = useQuery({
    queryKey: ['company-data-operator'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_data')
        .select('business_name, logo_url')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 30,
  });

  const handleLogout = async () => {
    try {
      await signOut();
      toast({ type: 'success', title: 'Sesión cerrada' });
    } catch {
      toast({ type: 'error', title: 'Error al cerrar sesión' });
    }
  };

  return (
    <OperatorActivityProvider>
      {/* La transmisión se monta ACÁ, por encima del <Outlet/>: atada a la
          sesión del operador y no a la pestaña visible. Dentro de una ruta, el
          cleanup de su efecto mataba el watcher GPS en cada navegación. */}
      <OperatorTransmissionProvider>
      <div className="operator-shell-concept operator-native-shell flex min-h-screen flex-col bg-background text-foreground">

        {/* ── Header ── */}
        <header
          className="operator-native-topbar flex flex-shrink-0 items-center justify-between px-4"
          style={{
            paddingTop: 'calc(env(safe-area-inset-top, 0px) + 10px)',
            paddingBottom: '10px',
          }}
        >
          <div className="flex min-w-0 items-center gap-3">
            {companyData?.logo_url ? (
              <img
                src={companyData.logo_url}
                alt={companyData.business_name || 'Grúas 5 Norte'}
                className="operator-native-brandmark size-10 flex-shrink-0 object-contain"
              />
            ) : (
              <div className="operator-native-brandmark flex size-10 flex-shrink-0 items-center justify-center">
                <Truck className="size-5 text-primary-foreground" />
              </div>
            )}
            <div className="min-w-0">
              <p className="operator-native-eyebrow">Grúas 5 Norte</p>
              <p className="truncate text-base font-semibold leading-tight text-foreground">TMS Operador</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <ThemeSelector />
            <Link
              to="/operator/profile"
              aria-label="Abrir Mi perfil"
              title="Mi perfil"
              className={`operator-native-icon-button flex size-11 items-center justify-center ${
                pathname === '/operator/profile' ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
              }`}
            >
              <UserRound className="size-4" />
            </Link>
            <button
              onClick={handleLogout}
              aria-label={`Cerrar sesión de ${user?.name || user?.email || 'operador'}`}
              className="operator-native-icon-button flex size-11 items-center justify-center text-muted-foreground"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </header>

        {/* ── Contenido ── */}
        <main
          className="operator-native-main flex-1 overflow-y-auto"
          style={{ paddingBottom: isInspection ? 'env(safe-area-inset-bottom, 0px)' : 'calc(env(safe-area-inset-bottom, 0px) + 76px)' }}
        >
          <div className={isInspection ? 'operator-native-content operator-native-content--inspection' : 'operator-native-content'}>
            <ErrorBoundary name="Portal Operador">
              <Suspense fallback={
                <div className="flex items-center justify-center py-20">
                  <RefreshCw className="size-6 animate-spin text-primary" />
                </div>
              }>
                <Outlet />
              </Suspense>
            </ErrorBoundary>
          </div>
        </main>

        {/* ── Bottom nav ── */}
        {!isInspection && <OperatorBottomNav />}
      </div>
      </OperatorTransmissionProvider>
    </OperatorActivityProvider>
  );
};
