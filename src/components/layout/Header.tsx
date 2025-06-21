
import React from 'react';
import { Menu, Search, User, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/custom-toast';
import { useUser } from '@/contexts/UserContext';
import { useSettings } from '@/hooks/useSettings';
import { NotificationsDropdown } from './NotificationsDropdown';

interface HeaderProps {
  setIsMobileMenuOpen: (open: boolean) => void;
}

export const Header = ({
  setIsMobileMenuOpen
}: HeaderProps) => {
  const navigate = useNavigate();
  const {
    user,
    logout
  } = useUser();
  const {
    settings
  } = useSettings();
  const {
    toast
  } = useToast();
  const isAdmin = user?.role === 'admin';
  const companyName = settings?.company?.name || 'Gruas 5 Norte';
  const companyLogo = settings?.company?.logo;
  const handleLogout = async () => {
    try {
      await logout();
      toast({
        type: 'success',
        title: 'Sesión cerrada',
        description: 'Has cerrado sesión correctamente'
      });
      navigate('/auth', {
        replace: true
      });
    } catch (error) {
      console.error("Header: Logout failed:", error);
      toast({
        type: 'error',
        title: 'Error al cerrar sesión',
        description: 'Por favor, intenta de nuevo.'
      });
    }
  };
  const handleProfileClick = () => {
    navigate('/profile');
  };
  return <header className="flex h-16 items-center justify-between backdrop-blur-lg border-b border-gray-700/50 px-4 sm:px-6 transition-colors duration-300 bg-black">
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setIsMobileMenuOpen(true)} 
          className="lg:hidden text-white bg-tms-green/20 border border-tms-green/30 hover:bg-tms-green hover:text-black"
          style={{
            color: '#ffffff',
            backgroundColor: 'rgba(156, 250, 36, 0.2)',
            borderColor: 'rgba(156, 250, 36, 0.3)'
          }}
        >
          <Menu className="h-6 w-6" />
          <span className="sr-only">Abrir menú</span>
        </Button>

        {/* Company branding */}
        <div className="flex items-center space-x-3">
          {companyLogo && <img src={companyLogo} alt="Logo empresa" className="h-8 w-8 object-contain" />}
          <div className="hidden sm:block">
            <h1 className="text-lg font-semibold text-white">{companyName}</h1>
            <p className="text-xs text-white">Sistema de Gestión</p>
          </div>
        </div>
        
        <div className="hidden lg:block relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white w-4 h-4" />
          <Input placeholder="Buscar servicios, clientes, facturas..." className="pl-10 bg-gray-800/50 border-gray-600 text-white placeholder-white/70 focus:border-tms-green focus:ring-tms-green" />
        </div>
      </div>

      <div className="flex items-center space-x-2 sm:space-x-4">
        <NotificationsDropdown />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-white hover:text-black hover:bg-tms-green rounded-full bg-tms-green/20 border border-tms-green/30"
              style={{
                color: '#ffffff',
                backgroundColor: 'rgba(156, 250, 36, 0.2)',
                borderColor: 'rgba(156, 250, 36, 0.3)'
              }}
            >
              <User className="w-5 h-5 text-tms-green" style={{ color: '#9cfa24' }} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="end" 
            className="bg-black border-tms-green/30 min-w-[200px] z-50"
            style={{
              background: '#000000',
              borderColor: 'rgba(156, 250, 36, 0.3)'
            }}
          >
            <DropdownMenuLabel 
              className="text-white font-semibold"
              style={{ color: '#ffffff' }}
            >
              {user?.name || 'Mi Cuenta'}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-tms-green/30" style={{ backgroundColor: 'rgba(156, 250, 36, 0.3)' }} />
            <DropdownMenuItem 
              className="text-white hover:text-black hover:bg-tms-green cursor-pointer focus:bg-tms-green focus:text-black" 
              onClick={handleProfileClick}
              style={{ color: '#ffffff' }}
            >
              <User className="w-4 h-4 mr-2" />
              Perfil
            </DropdownMenuItem>
            {isAdmin && <DropdownMenuItem 
              className="text-white hover:text-black hover:bg-tms-green cursor-pointer focus:bg-tms-green focus:text-black" 
              onClick={() => navigate('/settings')}
              style={{ color: '#ffffff' }}
            >
                <Settings className="w-4 h-4 mr-2" />
                Configuración
              </DropdownMenuItem>}
            <DropdownMenuSeparator className="bg-tms-green/30" style={{ backgroundColor: 'rgba(156, 250, 36, 0.3)' }} />
            <DropdownMenuItem 
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer focus:bg-red-500/10 focus:text-red-300" 
              onClick={handleLogout}
              style={{ color: '#ef4444' }}
            >
              Cerrar Sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>;
};
