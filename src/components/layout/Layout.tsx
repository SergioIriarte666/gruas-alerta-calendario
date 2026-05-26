
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
      <div className="flex min-h-screen overflow-hidden bg-background text-foreground">
        <Sidebar 
          isCollapsed={isCollapsed}
          setIsCollapsed={setIsCollapsed}
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
        />
        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col transition-all duration-300",
            "lg:ml-72",
            isCollapsed && "lg:ml-[4.5rem]"
          )}
        >
          <Header setIsMobileMenuOpen={setIsMobileMenuOpen} />
          <main
            className={cn(
              "flex-1 overflow-x-hidden overflow-y-auto bg-background",
              isMobile ? "p-3" : isTablet ? "p-4" : "p-6"
            )}
          >
            <div className="mx-auto w-full max-w-[1600px]">
              <div className="rounded-[28px] border border-border/60 bg-card/35 shadow-sm backdrop-blur-sm">
                <div className={cn(isMobile ? "p-3" : isTablet ? "p-4" : "p-6")}>
            <ErrorBoundary name="Página">
              <Suspense fallback={null}>
                <Outlet />
              </Suspense>
            </ErrorBoundary>
                </div>
              </div>
            </div>
          </main>
        </div>
        <QuickEntryFAB />

      </div>
    </QuickEntryProvider>
  );
};
