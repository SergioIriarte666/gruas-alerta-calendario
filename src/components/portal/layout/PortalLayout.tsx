
import React, { Suspense, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PortalHeader from './PortalHeader';
import PortalSidebar from './PortalSidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useClientNotifications } from '@/hooks/portal/useClientNotifications';

interface PortalLayoutProps {
  children?: React.ReactNode;
}

export const PortalLayout: React.FC<PortalLayoutProps> = ({ children }) => {
  useClientNotifications();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Mobile Menu Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 lg:hidden bg-black/50" 
          onClick={() => setIsMobileMenuOpen(false)} 
        />
      )}
      
      {/* Sidebar - hidden on mobile by default, shown when menu is open */}
      <div className={`
        ${isMobile ? 'fixed inset-y-0 left-0 z-50' : 'relative'}
        ${isMobile && !isMobileMenuOpen ? '-translate-x-full' : 'translate-x-0'}
        transition-transform duration-300 ease-in-out
      `}>
        <PortalSidebar onClose={() => setIsMobileMenuOpen(false)} showCloseButton={isMobile} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header with Menu Button */}
        {isMobile && (
          <div className="flex items-center border-b border-border/70 bg-card/95 px-4 py-3 backdrop-blur">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setIsMobileMenuOpen(true)}
              className="hover:bg-muted"
            >
              <Menu className="size-6" />
            </Button>
            <span className="ml-3 text-lg font-semibold text-primary">Portal de Clientes</span>
          </div>
        )}
        
        <PortalHeader />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-muted/20 p-4 md:p-6 lg:p-8">
          <ErrorBoundary name="Portal Cliente">
            <Suspense fallback={null}>
              {children || <Outlet />}
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
};
