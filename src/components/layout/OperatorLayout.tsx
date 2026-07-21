import React, { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { RefreshCw, LogOut, Truck } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/components/ui/custom-toast';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { OperatorBottomNav } from '@/components/operator/OperatorBottomNav';
import { useAuth } from '@/contexts/AuthContext';
import { useOperatorOfflineSync } from '@/hooks/useOperatorOfflineSync';
import { ThemeSelector } from '@/components/layout/ThemeSelector';

export const OperatorLayout = () => {
  const { user } = useUser();
  const { signOut } = useAuth();
  const { toast } = useToast();
  useOperatorOfflineSync();

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
      <div className="operator-shell-concept flex min-h-screen flex-col bg-background text-foreground">

        {/* ── Header ── */}
        <header
          className="flex flex-shrink-0 items-center justify-between border-b border-border/70 bg-card/95 px-4 shadow-sm backdrop-blur-xl"
          style={{
            paddingTop: 'calc(env(safe-area-inset-top, 0px) + 10px)',
            paddingBottom: '10px',
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {companyData?.logo_url ? (
              <img
                src={companyData.logo_url}
                alt="Logo"
                className="size-8 rounded-lg object-contain flex-shrink-0"
              />
            ) : (
              <div className="flex size-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary shadow-sm shadow-primary/20">
                <Truck className="size-4 text-primary-foreground" />
              </div>
            )}
            <div className="min-w-0">
              <p className="mb-0.5 text-xs leading-none text-muted-foreground">Portal Operador</p>
              <p className="truncate text-sm font-semibold leading-none text-foreground">
                {user?.name || user?.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <ThemeSelector />
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="size-3.5" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </header>

        {/* ── Contenido ── */}
        <main
          className="flex-1 overflow-y-auto"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 64px)' }}
        >
          <div className="px-4 py-4">
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
        <OperatorBottomNav />
      </div>
  );
};
