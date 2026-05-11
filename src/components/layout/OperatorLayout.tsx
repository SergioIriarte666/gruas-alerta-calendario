
import React, { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { User, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/components/ui/custom-toast';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export const OperatorLayout = () => {
  const { user, logout } = useUser();
  const { toast } = useToast();

  // Fetch company data for logo and name
  const { data: companyData } = useQuery({
    queryKey: ['company-data-operator'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_data')
        .select('business_name, logo_url')
        .limit(1)
        .single();
      
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
  });

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        type: 'success',
        title: 'Sesión cerrada',
        description: 'Has cerrado sesión correctamente'
      });
      window.location.href = '/auth';
    } catch (error) {
      console.error("Logout failed:", error);
      toast({
        type: 'error',
        title: 'Error al cerrar sesión',
        description: 'Por favor, intenta de nuevo.'
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {companyData?.logo_url ? (
              <img 
                src={companyData.logo_url} 
                alt={companyData.business_name || 'Logo empresa'} 
                className="w-10 h-10 rounded-lg object-contain"
              />
            ) : (
              <div className="w-10 h-10 bg-violet-600 rounded-lg flex items-center justify-center">
                <Truck className="w-6 h-6 text-white" />
              </div>
            )}
            <div>
              <h1 className="text-lg font-bold text-foreground">
                {companyData?.business_name || 'Panel del Operador'}
              </h1>
              <p className="text-xs text-muted-foreground">Panel del Operador</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 sm:space-x-4">
            <div className="hidden sm:flex items-center space-x-2 text-foreground">
              <User className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm truncate max-w-[120px]">{user?.name}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
            >
              Salir
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 sm:p-6">
        <ErrorBoundary name="Portal Operador">
          <Suspense fallback={null}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  );
};
