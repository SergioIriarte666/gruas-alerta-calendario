
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
import { useAppearance } from '@/contexts/AppearanceContext';

export const Layout = () => {
  const { isMobile, isTablet } = useDeviceType();
  const { preferences, updatePreferences } = useAppearance();
  const isCollapsed = preferences.sidebarCollapsed;
  const setIsCollapsed = (collapsed: boolean) => updatePreferences({ sidebarCollapsed: collapsed });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Configurar alertas de solicitudes de servicio
  useServiceRequestAlerts();

  return (
    <QuickEntryProvider>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-lg focus:outline-none">
        Saltar al contenido
      </a>
      <div className="app-shell-concept flex min-h-screen overflow-hidden bg-background text-foreground">
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
          <Header setIsMobileMenuOpen={setIsMobileMenuOpen} isMobileMenuOpen={isMobileMenuOpen} />
          <main
            id="main-content"
            className={cn(
              "app-density-content flex-1 overflow-x-hidden overflow-y-auto bg-background",
              isMobile ? "p-3" : isTablet ? "p-4" : preferences.density === 'compact' ? "p-4" : "p-6"
            )}
          >
            <div className="mx-auto w-full max-w-screen-2xl">
              <div className="rounded-3xl border border-border/60 bg-card/35 shadow-sm backdrop-blur-sm">
                <div className={cn(
                  "app-density-page",
                  isMobile ? "p-3" : isTablet ? "p-4" : preferences.density === 'compact' ? "p-4" : "p-6",
                )}>
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
