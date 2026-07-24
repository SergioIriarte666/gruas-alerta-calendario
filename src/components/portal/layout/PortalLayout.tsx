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
  const sidebarFrameRef = React.useRef<HTMLDivElement>(null);
  const menuTriggerRef = React.useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMobileMenuOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    // Trasladar el foco dentro del panel al abrir, para que teclado y lector
    // de pantalla no queden atrapados detrás del backdrop.
    const firstFocusable = sidebarFrameRef.current?.querySelector<HTMLElement>(
      'a, button, [tabindex]:not([tabindex="-1"])',
    );
    firstFocusable?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
      // Devolver el foco al disparador al cerrar.
      (menuTriggerRef.current ?? previouslyFocused)?.focus();
    };
  }, [isMobileMenuOpen]);

  return (
    <div className="portal-client-shell">
      <a href="#portal-contenido" className="portal-skip-link">
        Saltar al contenido
      </a>

      <button
        type="button"
        className={`portal-client-backdrop ${isMobileMenuOpen ? "is-open" : ""}`}
        onClick={() => setIsMobileMenuOpen(false)}
        aria-label="Cerrar menú"
        aria-hidden={!isMobileMenuOpen}
        tabIndex={isMobileMenuOpen ? 0 : -1}
      />

      <div
        ref={sidebarFrameRef}
        className={`portal-client-sidebar-frame ${isMobileMenuOpen ? "is-open" : ""}`}
        role={isMobileMenuOpen ? "dialog" : undefined}
        aria-modal={isMobileMenuOpen ? true : undefined}
        aria-label={isMobileMenuOpen ? "Menú de navegación" : undefined}
      >
        <PortalSidebar
          onClose={() => setIsMobileMenuOpen(false)}
          showCloseButton
        />
      </div>

      <div className="portal-client-workspace">
        <PortalHeader
          onMenuOpen={() => setIsMobileMenuOpen(true)}
          menuTriggerRef={menuTriggerRef}
        />
        <main className="portal-client-main" id="portal-contenido">
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
