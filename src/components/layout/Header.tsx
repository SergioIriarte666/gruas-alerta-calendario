
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
import { ThemeToggle } from '@/components/ui/theme-toggle';

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

  return <header className="flex h-16 items-center justify-between bg-background border-b border-border px-4 sm:px-6 transition-colors duration-300">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden border border-border/40 hover:bg-accent hover:text-accent-foreground">
          <Menu className="h-6 w-6" />
          <span className="sr-only">Abrir menú</span>
        </Button>

        {/* Company branding */}
        <div className="flex items-center space-x-3">
          {companyLogo && <img src={companyLogo} alt="Logo empresa" className="h-8 w-8 object-contain" />}
          <div className="hidden sm:block">
            <h1 className="text-lg font-semibold text-foreground">{companyName}</h1>
            <p className="text-xs text-muted-foreground">Sistema de Gestión</p>
          </div>
        </div>
        
        <div className="hidden lg:block relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input placeholder="Buscar servicios, clientes, facturas..." className="pl-10 bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary" />
        </div>
      </div>

      <div className="flex items-center space-x-2 sm:space-x-4">
        <ThemeToggle />
        <NotificationsDropdown />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full border border-border/40 hover:bg-accent hover:text-accent-foreground">
              <User className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover border-border min-w-[200px] z-50">
            <DropdownMenuLabel className="text-popover-foreground font-semibold">
              {user?.name || 'Mi Cuenta'}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem className="text-popover-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer focus:bg-accent focus:text-accent-foreground" onClick={handleProfileClick}>
              <User className="w-4 h-4 mr-2" />
              Perfil
            </DropdownMenuItem>
            {isAdmin && <DropdownMenuItem className="text-popover-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer focus:bg-accent focus:text-accent-foreground" onClick={() => navigate('/settings')}>
                <Settings className="w-4 h-4 mr-2" />
                Configuración
              </DropdownMenuItem>}
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem className="text-destructive hover:text-destructive-foreground hover:bg-destructive cursor-pointer focus:bg-destructive focus:text-destructive-foreground" onClick={handleLogout}>
              Cerrar Sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>;
};
