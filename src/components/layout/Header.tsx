
import React from 'react';
import { Menu, User, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useUser } from '@/contexts/UserContext';
import { useSettings } from '@/hooks/useSettings';
import { useDeviceType } from '@/hooks/useDeviceType';
import { cleanupAuthState } from '@/utils/authCleanup';
import { cn } from '@/lib/utils';
import { NotificationsDropdown } from './NotificationsDropdown';
import { GlobalSearch } from './GlobalSearch';
import PWAInstallButton from '@/components/PWAInstallButton';

interface HeaderProps {
  setIsMobileMenuOpen: (open: boolean) => void;
}

export const Header = ({
  setIsMobileMenuOpen
}: HeaderProps) => {
  const navigate = useNavigate();
  const { user, logout } = useUser();
  const { settings } = useSettings();
  const { isMobile, isTablet } = useDeviceType();
  
  const isAdmin = user?.role === 'admin';
  const companyName = settings?.company?.name || 'Gruas 5 Norte';
  const companyLogo = settings?.company?.logo;

  const handleLogout = async () => {
    try {
      console.log('Header: Logout initiated...');
      
      toast.info('Cerrando sesión...', {
        description: 'Limpiando datos de usuario'
      });
      
      // Use the improved logout from UserContext
      await logout();
    } catch (error) {
      console.error("Header: Logout failed:", error);
      
      toast.error('Error al cerrar sesión', {
        description: 'Sesión cerrada forzosamente'
      });
      
      // Forzar limpieza y redirección como último recurso
      cleanupAuthState();
      window.location.href = '/auth';
    }
  };

  const handleProfileClick = () => {
    navigate('/profile');
  };

  return (
    <header className={cn(
      "flex items-center justify-between bg-white border-b border-gray-200 transition-colors duration-300",
      isMobile ? "h-14 px-3" : isTablet ? "h-15 px-4" : "h-16 px-6"
    )} style={{ background: '#ffffff' }}>
      <div className="flex items-center gap-3">
        <Button 
          variant="ghost" 
          size={isMobile ? "sm" : "icon"} 
          onClick={() => setIsMobileMenuOpen(true)} 
          className="lg:hidden text-black bg-tms-green/20 border border-tms-green/30 hover:bg-tms-green hover:text-black"
        >
          <Menu className={cn(isMobile ? "h-5 w-5" : "h-6 w-6")} />
          <span className="sr-only">Abrir menú</span>
        </Button>

        {/* Company branding */}
        <div className="flex items-center space-x-2">
          {companyLogo && <img src={companyLogo} alt="Logo empresa" className={cn(
            "object-contain",
            isMobile ? "h-6 w-6" : "h-8 w-8"
          )} />}
          <div className={cn(isMobile ? "hidden" : "block")}>
            <h1 className={cn(
              "font-semibold text-black",
              isMobile ? "text-sm" : isTablet ? "text-base" : "text-lg"
            )}>{companyName}</h1>
            <p className="text-xs text-gray-600">Sistema de Gestión</p>
          </div>
        </div>
        
        <div className="hidden lg:block">
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
              className="text-black hover:text-black hover:bg-tms-green rounded-full bg-tms-green/20 border border-tms-green/30"
            >
              <User className={cn(
                "text-tms-green",
                isMobile ? "w-4 h-4" : "w-5 h-5"
              )} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-white border-gray-200 min-w-[200px] z-50" style={{ background: '#ffffff', color: '#000000', borderColor: '#d1d5db' }}>
            <DropdownMenuLabel className="text-black font-semibold" style={{ color: '#000000' }}>
              {user?.name || 'Mi Cuenta'}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-gray-200" style={{ backgroundColor: '#e5e7eb' }} />
            <DropdownMenuItem className="text-black hover:text-black hover:bg-tms-green cursor-pointer focus:bg-tms-green focus:text-black" style={{ color: '#000000' }} onClick={handleProfileClick}>
              <User className="w-4 h-4 mr-2" />
              Perfil
            </DropdownMenuItem>
            {isAdmin && <DropdownMenuItem className="text-black hover:text-black hover:bg-tms-green cursor-pointer focus:bg-tms-green focus:text-black" style={{ color: '#000000' }} onClick={() => navigate('/settings')}>
                <Settings className="w-4 h-4 mr-2" />
                Configuración
              </DropdownMenuItem>}
            <DropdownMenuSeparator className="bg-gray-200" style={{ backgroundColor: '#e5e7eb' }} />
            <DropdownMenuItem className="text-red-600 hover:text-red-700 hover:bg-red-50 cursor-pointer focus:bg-red-50 focus:text-red-700" style={{ color: '#dc2626' }} onClick={handleLogout}>
              Cerrar Sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
