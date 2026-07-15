
import React, { useEffect, useMemo, useState } from 'react';
import { Bell, FileText, FileWarning as FileAlert, History, LayoutDashboard, LogOut, Plus, Search } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { formatInTimeZone } from 'date-fns-tz';
import { es } from 'date-fns/locale';
import { businessClock } from '@/utils/businessClock';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { usePortalOCCount } from '@/hooks/portal/usePortalOCCount';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const PortalHeader: React.FC = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const ocCount = usePortalOCCount();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const quickLinks = useMemo(
    () => [
      {
        label: 'Dashboard',
        description: 'Resumen general del portal',
        href: '/portal/dashboard',
        icon: LayoutDashboard,
      },
      {
        label: 'Mis Servicios',
        description: 'Revisa servicios, estados y fechas',
        href: '/portal/services',
        icon: History,
      },
      {
        label: 'Sin orden de compra',
        description: ocCount > 0 ? `${ocCount} servicio(s) esperando O.C.` : 'No hay O.C. pendientes',
        href: '/portal/purchase-orders',
        icon: FileAlert,
      },
      {
        label: 'Solicitar Servicio',
        description: 'Crea una nueva solicitud para tu empresa',
        href: '/portal/request-service',
        icon: Plus,
      },
      {
        label: 'Mis Facturas',
        description: 'Consulta facturas y saldos pendientes',
        href: '/portal/invoices',
        icon: FileText,
      },
    ],
    [ocCount]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsSearchOpen((currentValue) => !currentValue);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogout = async () => {
    try {
      toast.info('Cerrando sesión...', {
        description: 'Limpiando datos de usuario'
      });
      
      await signOut();
    } catch (_error) {
      toast.error('Error al cerrar sesión', {
        description: 'Sesión cerrada forzosamente'
      });
    }
  };

  const handleNavigate = (href: string) => {
    navigate(href);
    setIsSearchOpen(false);
  };

  const dateLabel = formatInTimeZone(new Date(), businessClock.timezone(), "EEEE d 'de' MMMM, yyyy", { locale: es });

  return (
    <>
      <header className="flex items-center justify-between border-b border-[#e2e8f0] bg-white px-5 py-2.5">
        <span className="text-[11px] capitalize text-[#94a3b8]">{dateLabel}</span>
        <div className="flex items-center gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="relative flex h-7 w-7 items-center justify-center rounded-[7px] border border-[#e2e8f0] bg-white text-[#64748b] transition-colors hover:bg-slate-50 hover:text-[#334155]"
                aria-label="Notificaciones"
              >
                <Bell className="size-[13px]" />
                {ocCount > 0 && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-violet-600" />}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel>Notificaciones</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => navigate('/portal/purchase-orders')}
                className="flex items-start gap-2"
              >
                <FileAlert className="mt-0.5 size-4 text-amber-600" />
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-[#0f172a]">Ordenes de compra pendientes</p>
                  <p className="text-xs text-[#64748b]">
                    {ocCount > 0
                      ? `Tienes ${ocCount} servicio(s) esperando orden de compra`
                      : 'No tienes servicios pendientes de O.C.'}
                  </p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate('/portal/services')}
                className="flex items-start gap-2"
              >
                <History className="mt-0.5 size-4 text-violet-700" />
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-[#0f172a]">Ir a Mis Servicios</p>
                  <p className="text-xs text-[#64748b]">Revisa estados, fechas y vehiculos trasladados</p>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className="flex h-7 w-7 items-center justify-center rounded-[7px] border border-[#e2e8f0] bg-white text-[#64748b] transition-colors hover:bg-slate-50 hover:text-[#334155]"
            aria-label="Buscar"
            title="Buscar secciones del portal"
          >
            <Search className="size-[13px]" />
          </button>
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-1.5 rounded-[7px] px-2.5 py-1.5 text-[12px] text-[#64748b] hover:bg-slate-50"
        >
          <LogOut className="size-[13px]" />
          <span>Salir</span>
        </button>
        </div>
      </header>

      <CommandDialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
        <CommandInput placeholder="Buscar secciones del portal..." />
        <CommandList>
          <CommandEmpty>No encontramos una seccion con ese nombre.</CommandEmpty>
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
                  <Icon className="size-4 text-[#64748b]" />
                  <div className="flex flex-1 flex-col">
                    <span className="text-sm font-medium text-[#0f172a]">{link.label}</span>
                    <span className="text-xs text-[#94a3b8]">{link.description}</span>
                  </div>
                  {isCurrent && (
                    <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700">
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
