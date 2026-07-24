import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  FileText,
  FileWarning as FileAlert,
  History,
  LayoutDashboard,
  Plus,
  Truck,
  X,
} from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import { useUser } from "@/contexts/UserContext";
import { usePortalOCCount } from "@/hooks/portal/usePortalOCCount";
import { useClientBranding } from "@/hooks/portal/useClientBranding";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import PortalSupportDialog from "@/components/portal/PortalSupportDialog";

interface PortalSidebarProps {
  onClose?: () => void;
  showCloseButton?: boolean;
}

const PortalSidebar: React.FC<PortalSidebarProps> = ({
  onClose,
  showCloseButton = false,
}) => {
  const { settings } = useSettings();
  const { user } = useUser();
  const { data: branding } = useClientBranding();
  const location = useLocation();
  const ocCount = usePortalOCCount();
  const companyName = settings?.company?.name || "Grúas Alerta";
  const displayLogo = branding?.logoUrl || settings?.company?.logo;
  const displayName = branding?.companyName || companyName;
  const userName = user?.name || user?.email || "Cliente";
  const userInitials = userName.slice(0, 2).toUpperCase();
  const supportEmail =
    settings?.company?.email?.trim() || "soporte@gruas5norte.cl";
  const supportPhone =
    settings?.company?.operationalContactPhone?.trim() ||
    settings?.company?.phone?.trim();

  const navigationItems = [
    {
      name: "Dashboard",
      href: "/portal/dashboard",
      icon: LayoutDashboard,
      group: "Operación",
    },
    {
      name: "Mis Servicios",
      href: "/portal/services",
      icon: History,
      group: "Operación",
    },
    {
      name: "Solicitar Servicio",
      href: "/portal/request-service",
      icon: Plus,
      group: "Operación",
    },
    {
      name: "Sin orden de compra",
      href: "/portal/purchase-orders",
      icon: FileAlert,
      badgeCount: ocCount,
      urgent: ocCount > 0,
      group: "Administración",
    },
    {
      name: "Mis Facturas",
      href: "/portal/invoices",
      icon: FileText,
      group: "Administración",
    },
  ];
  const navigationGroups = ["Operación", "Administración"];

  const handleNavClick = () => {
    if (onClose) {
      onClose();
    }
  };

  return (
    <aside className="portal-client-sidebar">
      <div className="portal-client-sidebar__brand">
        <div className="portal-client-brand">
          <div className="portal-client-brand__identity">
            {displayLogo ? (
              <div className="portal-client-brand__mark has-logo">
                <img
                  src={displayLogo}
                  alt={displayName}
                />
              </div>
            ) : (
              <div className="portal-client-brand__mark">
                <Truck />
              </div>
            )}
            <div className="portal-client-brand__copy">
              <strong>{displayName}</strong>
              <small>Portal de clientes</small>
            </div>
          </div>
          {showCloseButton && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="portal-client-sidebar__close"
              aria-label="Cerrar menú"
            >
              <X />
            </Button>
          )}
        </div>
      </div>

      <nav className="portal-client-nav" aria-label="Navegación principal">
        {navigationGroups.map((group) => (
          <div className="portal-client-nav__group" key={group}>
            <p>{group}</p>
            {navigationItems
              .filter((item) => item.group === group)
              .map((item) => {
                const isActive =
                  location.pathname === item.href ||
                  (item.href === "/portal/dashboard" &&
                    location.pathname === "/portal");
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={handleNavClick}
                    className={cn(
                      "portal-client-nav__item",
                      isActive && "is-active",
                      item.urgent && "is-urgent",
                    )}
                  >
                    <item.icon />
                    <span>{item.name}</span>
                    {item.href === "/portal/purchase-orders" && ocCount > 0 && (
                      <b>{ocCount}</b>
                    )}
                  </Link>
                );
              })}
          </div>
        ))}
      </nav>

      <div className="portal-client-sidebar__footer">
        <PortalSupportDialog
          companyName={branding?.companyName || "Cliente"}
          clientEmail={user?.email}
          email={supportEmail}
          phone={supportPhone}
          onAction={handleNavClick}
        />
        <Link
          to="/portal/account"
          onClick={handleNavClick}
          className="portal-client-account"
          aria-label="Abrir mi cuenta"
        >
          <span>{userInitials}</span>
          <div>
            <strong>{userName}</strong>
            <small>{branding?.companyName || "Cliente"}</small>
          </div>
          <i title="Conectado" />
        </Link>
      </div>
    </aside>
  );
};

export default PortalSidebar;
