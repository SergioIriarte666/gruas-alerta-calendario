import React from 'react';
import { Menu, User, Settings, Building2, HardHat } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useUser } from '@/contexts/UserContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/hooks/useSettings';
import { useDeviceType } from '@/hooks/useDeviceType';
import { cn } from '@/lib/utils';
import { NotificationsDropdown } from './NotificationsDropdown';
import { GlobalSearch } from './GlobalSearch';
import PWAInstallButton from '@/components/PWAInstallButton';

interface HeaderProps {
  setIsMobileMenuOpen: (open: boolean) => void;
  isMobileMenuOpen: boolean;
}

export const Header = ({
  setIsMobileMenuOpen,
  isMobileMenuOpen,
}: HeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();
  const { signOut } = useAuth();
  const { settings } = useSettings();
  const { isMobile, isTablet } = useDeviceType();
  
  const isAdmin = user?.role === 'admin';
  const companyName = settings?.company?.name || 'Gruas 5 Norte';
  const companyLogo = settings?.company?.logo;
  const routeMeta: Record<string, { title: string; description: string }> = {
    '/dashboard': { title: 'Dashboard Principal', description: 'Resumen ejecutivo y actividad reciente' },
    '/services': { title: 'Servicios', description: 'Operaciones y seguimiento diario' },
    '/costs': { title: 'Costos', description: 'Control operativo y financiero' },
    '/closures': { title: 'Cierres', description: 'Consolidado de cierre e ingresos' },
    '/invoices': { title: 'Facturas', description: 'Facturación, vencimientos y cobros' },
    '/clients': { title: 'Clientes', description: 'Cartera, contactos y actividad comercial' },
    '/calendar': { title: 'Calendario', description: 'Programación operacional y eventos' },
    '/reports': { title: 'Reportes', description: 'Análisis y métricas del negocio' },
    '/settings': { title: 'Configuración', description: 'Preferencias y parámetros del sistema' },
  };
  const currentMeta =
    routeMeta[location.pathname] ?? {
      title: companyName,
      description: 'Plataforma de gestión operacional',
    };

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

  const handleProfileClick = () => {
    navigate('/profile');
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex items-center justify-between border-b border-border/70 bg-background/85 backdrop-blur-xl transition-colors duration-300",
        isMobile ? "min-h-[3.5rem] px-3" : isTablet ? "min-h-[4rem] px-4" : "min-h-[4rem] px-6"
      )}
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
      }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Button 
          variant="ghost" 
          size={isMobile ? "sm" : "icon"} 
          onClick={() => setIsMobileMenuOpen(true)} 
          className="lg:hidden text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Menu className={cn(isMobile ? "size-5" : "size-6")} />
          <span className="sr-only">{isMobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}</span>
        </Button>

        <div className="flex min-w-0 items-center gap-3">
          {companyLogo && <img src={companyLogo} alt="Logo empresa" className={cn(
            "rounded-md object-contain ring-1 ring-border/70",
            isMobile ? "size-6" : "size-8"
          )} />}

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold text-foreground">{currentMeta.title}</p>
              {!isMobile && (
                <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  <Building2 className="size-3" />
                  {companyName}
                </span>
              )}
            </div>
            <p className={cn(
              "truncate text-xs text-muted-foreground",
              isMobile && "max-w-[160px]",
            )}>
              {isMobile ? currentMeta.title : currentMeta.description}
            </p>
          </div>
        </div>

        <div className="hidden min-w-0 flex-1 items-center justify-center px-6 lg:flex">
          <GlobalSearch />
        </div>
      </div>

      <div className={cn(
        "flex items-center",
        isMobile ? "space-x-1" : isTablet ? "space-x-2" : "space-x-4"
      )}>
        {!isMobile && <PWAInstallButton />}
        <NotificationsDropdown />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size={isMobile ? "sm" : "icon"} 
              className="rounded-full border border-border/70 bg-card text-foreground hover:bg-accent hover:text-foreground"
            >
              <User className={cn(
                "text-primary",
                isMobile ? "size-4" : "size-5"
              )} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="z-50 min-w-[220px] border border-border/70 bg-popover/95 shadow-lg backdrop-blur">
            <DropdownMenuLabel className="text-foreground font-semibold">
              {user?.name || 'Mi Cuenta'}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem className="text-foreground hover:bg-primary hover:text-primary-foreground cursor-pointer" onClick={handleProfileClick}>
              <User className="size-4 mr-2" />
              Perfil
            </DropdownMenuItem>
            {user?.operator_id && (
              <DropdownMenuItem className="text-foreground hover:bg-primary hover:text-primary-foreground cursor-pointer" onClick={() => navigate('/operator')}>
                <HardHat className="size-4 mr-2" />
                Portal Operador
              </DropdownMenuItem>
            )}
            {isAdmin && <DropdownMenuItem className="text-foreground hover:bg-primary hover:text-primary-foreground cursor-pointer" onClick={() => navigate('/settings')}>
                <Settings className="size-4 mr-2" />
                Configuración
              </DropdownMenuItem>}
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem className="text-destructive hover:bg-destructive hover:text-destructive-foreground cursor-pointer" onClick={handleLogout}>
              Cerrar Sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
