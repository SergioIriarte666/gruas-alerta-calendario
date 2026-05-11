
import React, { Suspense, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { QuickEntryFAB } from '@/components/quick-entry/QuickEntryFAB';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { QuickEntryProvider } from '@/contexts/QuickEntryContext';
import { useServiceRequestAlerts } from '@/hooks/useServiceRequestAlerts';
import { useDeviceType } from '@/hooks/useDeviceType';
import { cn } from '@/lib/utils';

export const Layout = () => {
  const { isMobile, isTablet } = useDeviceType();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Configurar alertas de solicitudes de servicio
  useServiceRequestAlerts();

  return (
    <QuickEntryProvider>
        <div className="min-h-screen bg-white text-black flex overflow-hidden">
          <Sidebar 
            isCollapsed={isCollapsed}
            setIsCollapsed={setIsCollapsed}
            isMobileMenuOpen={isMobileMenuOpen}
            setIsMobileMenuOpen={setIsMobileMenuOpen}
          />
          <div className={cn(
            "flex-1 flex flex-col min-w-0 transition-all duration-300",
            "lg:ml-64",
            isCollapsed && "lg:ml-16"
          )}>
          <Header setIsMobileMenuOpen={setIsMobileMenuOpen} />
          <main className={cn(
            "flex-1 overflow-y-auto overflow-x-hidden bg-white",
            isMobile ? "p-3" : isTablet ? "p-4" : "p-6"
          )}>
            <ErrorBoundary name="Página">
              <Suspense fallback={null}>
                <Outlet />
              </Suspense>
            </ErrorBoundary>
          </main>
        </div>
        <QuickEntryFAB />
        
      </div>
    </QuickEntryProvider>
  );
};
