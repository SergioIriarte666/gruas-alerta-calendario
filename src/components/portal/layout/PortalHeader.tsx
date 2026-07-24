import React, { useEffect, useMemo, useState } from "react";
import {
  Bell,
  ChevronDown,
  FileText,
  FileWarning as FileAlert,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Search,
  UserRound,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { formatInTimeZone } from "date-fns-tz";
import { es } from "date-fns/locale";
import { businessClock } from "@/utils/businessClock";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { usePortalOCCount } from "@/hooks/portal/usePortalOCCount";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeSelector } from "@/components/layout/ThemeSelector";
import { useUser } from "@/contexts/UserContext";

interface PortalHeaderProps {
  onMenuOpen: () => void;
}

const PortalHeader: React.FC<PortalHeaderProps> = ({ onMenuOpen }) => {
  const { signOut } = useAuth();
  const { user } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const ocCount = usePortalOCCount();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const quickLinks = useMemo(
    () => [
      {
        label: "Dashboard",
        description: "Resumen general del portal",
        href: "/portal/dashboard",
        icon: LayoutDashboard,
      },
      {
        label: "Mis Servicios",
        description: "Revisa servicios, estados y fechas",
        href: "/portal/services",
        icon: History,
      },
      {
        label: "Sin orden de compra",
        description:
          ocCount > 0
            ? `${ocCount} servicio(s) esperando O.C.`
            : "No hay O.C. pendientes",
        href: "/portal/purchase-orders",
        icon: FileAlert,
      },
      {
        label: "Solicitar Servicio",
        description: "Crea una nueva solicitud para tu empresa",
        href: "/portal/request-service",
        icon: Plus,
      },
      {
        label: "Mis Facturas",
        description: "Consulta facturas y saldos pendientes",
        href: "/portal/invoices",
        icon: FileText,
      },
      {
        label: "Mi Cuenta",
        description: "Perfil, empresa, preferencias y seguridad",
        href: "/portal/account",
        icon: UserRound,
      },
    ],
    [ocCount],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsSearchOpen((currentValue) => !currentValue);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleLogout = async () => {
    try {
      toast.info("Cerrando sesión...", {
        description: "Limpiando datos de usuario",
      });

      await signOut();
    } catch (_error) {
      toast.error("Error al cerrar sesión", {
        description: "Sesión cerrada forzosamente",
      });
    }
  };

  const handleNavigate = (href: string) => {
    navigate(href);
    setIsSearchOpen(false);
  };

  const dateLabel = formatInTimeZone(
    new Date(),
    businessClock.timezone(),
    "EEEE d 'de' MMMM, yyyy",
    { locale: es },
  );
  const userName = user?.name || user?.email || "Cliente";
  const initials = userName.slice(0, 2).toUpperCase();

  return (
    <>
      <header className="portal-client-topbar">
        <button
          type="button"
          className="portal-client-topbar__menu"
          onClick={onMenuOpen}
          aria-label="Abrir menú"
        >
          <Menu />
        </button>
        <button
          type="button"
          onClick={() => setIsSearchOpen(true)}
          className="portal-client-search"
          aria-label="Buscar en el portal"
        >
          <Search />
          <span>Buscar servicio, factura o patente…</span>
          <kbd>⌘ K</kbd>
        </button>
        <div className="portal-client-topbar__actions">
          <span className="portal-client-online">
            <i />
            Operación en línea
          </span>
          <ThemeSelector />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="portal-client-icon-button"
                aria-label="Notificaciones"
              >
                <Bell />
                {ocCount > 0 && (
                  <span className="portal-client-notification-dot" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel>Notificaciones</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => navigate("/portal/purchase-orders")}
                className="flex items-start gap-2"
              >
                <FileAlert className="mt-0.5 size-4 text-warning-text" />
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-foreground">
                    Ordenes de compra pendientes
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {ocCount > 0
                      ? `Tienes ${ocCount} servicio(s) esperando orden de compra`
                      : "No tienes servicios pendientes de O.C."}
                  </p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate("/portal/services")}
                className="flex items-start gap-2"
              >
                <History className="mt-0.5 size-4 text-primary" />
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-foreground">
                    Ir a Mis Servicios
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Revisa estados, fechas y vehiculos trasladados
                  </p>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="portal-client-user-menu">
                <span>{initials}</span>
                <div>
                  <strong>{userName}</strong>
                  <small className="capitalize">{dateLabel}</small>
                </div>
                <ChevronDown />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Cuenta de cliente</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/portal/account")}>
                <UserRound className="mr-2 size-4" />
                Mi cuenta
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 size-4" />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <CommandDialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
        <CommandInput placeholder="Buscar secciones del portal..." />
        <CommandList>
          <CommandEmpty>
            No encontramos una seccion con ese nombre.
          </CommandEmpty>
          <CommandGroup heading="Navegacion">
            {quickLinks.map((link) => {
              const isCurrent = location.pathname === link.href;
              const Icon = link.icon;

              return (
                <CommandItem
                  key={link.href}
                  value={`${link.label} ${link.description}`}
                  onSelect={() => handleNavigate(link.href)}
                  className="flex items-center gap-3"
                >
                  <Icon className="size-4 text-muted-foreground" />
                  <div className="flex flex-1 flex-col">
                    <span className="text-sm font-medium text-foreground">
                      {link.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {link.description}
                    </span>
                  </div>
                  {isCurrent && (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-primary">
                      Actual
                    </span>
                  )}
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
};

export default PortalHeader;
