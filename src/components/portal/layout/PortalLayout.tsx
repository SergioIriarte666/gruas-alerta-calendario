import React, { Suspense, useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import PortalHeader from "./PortalHeader";
import PortalSidebar from "./PortalSidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useClientNotifications } from "@/hooks/portal/useClientNotifications";
import { useSettings } from "@/hooks/useSettings";

interface PortalLayoutProps {
  children?: React.ReactNode;
}

export const PortalLayout: React.FC<PortalLayoutProps> = ({ children }) => {
  useClientNotifications();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();
  const { settings } = useSettings();
  const companyName = settings?.company?.name || "Portal de Clientes";
  const companyLogo = settings?.company?.logo;

  return (
    <div className="flex h-screen bg-gradient-portal text-foreground">
      {/* Mobile Menu Backdrop */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-overlay/50 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - hidden on mobile by default, shown when menu is open */}
      <div
        className={`
        ${isMobile ? "fixed inset-y-0 left-0 z-50" : "relative"}
        ${isMobile && !isMobileMenuOpen ? "-translate-x-full" : "translate-x-0"}
        transition-transform duration-300 ease-in-out
      `}
      >
        <PortalSidebar
          onClose={() => setIsMobileMenuOpen(false)}
          showCloseButton={isMobile}
        />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header with Menu Button */}
        {isMobile && (
          <div className="flex items-center border-b border-border bg-card px-4 py-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileMenuOpen(true)}
              className="hover:bg-muted/70"
            >
              <Menu className="size-6" />
            </Button>
            <div className="ml-3 flex items-center gap-3">
              {companyLogo && (
                <img
                  src={companyLogo}
                  alt="Logo empresa"
                  className="size-8 object-contain"
                />
              )}
              <div>
                <div className="text-sm font-semibold text-foreground">
                  {companyName}
                </div>
                <div className="text-xs text-muted-foreground">
                  Portal de Clientes
                </div>
              </div>
            </div>
          </div>
        )}

        <PortalHeader />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-transparent p-4 md:p-6 lg:p-8">
          <ErrorBoundary name="Portal Cliente">
            <Suspense fallback={null}>{children || <Outlet />}</Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
};
