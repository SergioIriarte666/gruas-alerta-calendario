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

  const navigationItems = [
    {
      name: "Dashboard",
      href: "/portal/dashboard",
      icon: LayoutDashboard,
    },
    {
      name: "Mis Servicios",
      href: "/portal/services",
      icon: History,
    },
    {
      name: "Sin orden de compra",
      href: "/portal/purchase-orders",
      icon: FileAlert,
      badgeCount: ocCount,
      urgent: ocCount > 0,
    },
    {
      name: "Solicitar Servicio",
      href: "/portal/request-service",
      icon: Plus,
    },
    {
      name: "Mis Facturas",
      href: "/portal/invoices",
      icon: FileText,
    },
  ];

  const handleNavClick = () => {
    if (onClose) {
      onClose();
    }
  };

  return (
    <aside className="flex h-full w-64 flex-col border-r border-border bg-card p-4">
      <div className="mb-6 pb-4 border-b border-border/60">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {displayLogo ? (
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-muted/40 p-1">
                <img
                  src={displayLogo}
                  alt={displayName}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : (
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-primary">
                <Truck className="size-4 text-primary-foreground" />
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {displayName}
              </p>
              <p className="text-xs text-muted-foreground">
                Portal de clientes
              </p>
            </div>
          </div>
          {showCloseButton && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-muted-foreground hover:bg-muted/70 hover:text-foreground"
            >
              <X className="size-5" />
            </Button>
          )}
        </div>
      </div>
      <p className="mb-1 mt-2 px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground/50">
        Menú
      </p>
      <nav className="flex flex-col gap-y-1">
        {navigationItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.name}
              to={item.href}
              onClick={handleNavClick}
              className={cn(
                "flex items-center gap-2 rounded-md px-2.5 py-2 text-xs transition-colors",
                isActive && !item.urgent
                  ? "bg-accent font-medium text-primary"
                  : "",
                isActive && item.urgent
                  ? "bg-warning-soft font-medium text-warning-text"
                  : "",
                !isActive
                  ? "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                  : "",
              )}
            >
              <item.icon className="size-3.5" />
              <span>{item.name}</span>
              {item.href === "/portal/purchase-orders" && ocCount > 0 && (
                <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-warning px-1 text-xs font-medium text-warning-foreground">
                  {ocCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-border/60 pt-3">
        <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 p-2.5">
          <div className="flex size-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-primary text-xs font-medium text-primary-foreground">
            {userInitials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-foreground">
              {userName}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {branding?.companyName || "Cliente"}
            </p>
          </div>
          <div
            className="ml-auto size-2 flex-shrink-0 rounded-full bg-success"
            title="Conectado"
          />
        </div>
      </div>
    </aside>
  );
};

export default PortalSidebar;
