import React, { Suspense } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { RefreshCw, LogOut, Truck } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/components/ui/custom-toast';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { OperatorThemeForcer } from '@/components/operator/OperatorThemeForcer';
import { OperatorBottomNav } from '@/components/operator/OperatorBottomNav';

export const OperatorLayout = () => {
  const { user, logout } = useUser();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { pathname } = useLocation();

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
      await logout();
      toast({ type: 'success', title: 'Sesión cerrada' });
      window.location.href = '/auth';
    } catch {
      toast({ type: 'error', title: 'Error al cerrar sesión' });
    }
  };

  return (
    <>
      <OperatorThemeForcer />

      <div className="min-h-screen bg-zinc-950 flex flex-col">

        {/* ── Header ── */}
        <header
          className="flex-shrink-0 bg-zinc-900 border-b border-white/5 px-4 flex items-center justify-between"
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
              <div className="size-8 bg-violet-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <Truck className="size-4 text-white" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[11px] text-zinc-500 leading-none mb-0.5">Portal Operador</p>
              <p className="text-sm font-semibold text-white truncate leading-none">
                {user?.name || user?.email}
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-950/30 transition-colors text-xs"
          >
            <LogOut className="size-3.5" />
            <span>Salir</span>
          </button>
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
                  <RefreshCw className="size-6 text-violet-500 animate-spin" />
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
    </>
  );
};
