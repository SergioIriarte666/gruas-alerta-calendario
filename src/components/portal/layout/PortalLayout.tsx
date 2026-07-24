import React, { Suspense, useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import PortalHeader from "./PortalHeader";
import PortalSidebar from "./PortalSidebar";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useClientNotifications } from "@/hooks/portal/useClientNotifications";
import "@/styles/portal-client.css";

interface PortalLayoutProps {
  children?: React.ReactNode;
}

export const PortalLayout: React.FC<PortalLayoutProps> = ({ children }) => {
  useClientNotifications();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMobileMenuOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isMobileMenuOpen]);

  return (
    <div className="portal-client-shell">
      <button
        type="button"
        className={`portal-client-backdrop ${isMobileMenuOpen ? "is-open" : ""}`}
        onClick={() => setIsMobileMenuOpen(false)}
        aria-label="Cerrar menú"
        tabIndex={isMobileMenuOpen ? 0 : -1}
      />

      <div
        className={`portal-client-sidebar-frame ${isMobileMenuOpen ? "is-open" : ""}`}
      >
        <PortalSidebar
          onClose={() => setIsMobileMenuOpen(false)}
          showCloseButton
        />
      </div>

      <div className="portal-client-workspace">
        <PortalHeader onMenuOpen={() => setIsMobileMenuOpen(true)} />
        <main className="portal-client-main">
          <div className="portal-client-main__inner">
            <ErrorBoundary name="Portal Cliente">
              <Suspense fallback={null}>{children || <Outlet />}</Suspense>
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
};
