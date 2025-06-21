import React from 'react';
import { Menu, Search, User, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/custom-toast';
import { useUser } from '@/contexts/UserContext';
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
    toast
  } = useToast();
  const isAdmin = user?.role === 'admin';
  const handleLogout = async () => {
    try {
      await logout();
      toast({
        type: 'success',
        title: 'Sesión cerrada',
        description: 'Has cerrado sesión correctamente'
      });
      window.location.href = '/auth';
    } catch (error) {
      console.error("Logout failed:", error);
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
  return <header className="flex h-16 items-center justify-between backdrop-blur-lg border-b border-border px-4 sm:px-6 transition-colors duration-300 bg-zinc-900">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="lg:hidden text-muted-foreground hover:text-foreground" onClick={() => setIsMobileMenuOpen(true)}>
          <Menu className="h-6 w-6" />
          <span className="sr-only">Abrir menú</span>
        </Button>
        
        {/* Search */}
        <div className="hidden lg:block relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input placeholder="Buscar servicios, clientes, facturas..." className="pl-10 bg-input border-border text-foreground placeholder-muted-foreground focus:border-tms-green" />
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center space-x-2 sm:space-x-4">
        {/* Notifications */}
        <NotificationsDropdown />

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground rounded-full">
              <User className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-card border-border min-w-[200px] z-50">
            <DropdownMenuLabel className="text-foreground font-semibold">
              {user?.name || 'Mi Cuenta'}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem className="text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer focus:bg-accent focus:text-foreground" onClick={handleProfileClick}>
              <User className="w-4 h-4 mr-2" />
              Perfil
            </DropdownMenuItem>
            {isAdmin && <DropdownMenuItem className="text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer focus:bg-accent focus:text-foreground" onClick={() => navigate('/settings')}>
                <Settings className="w-4 h-4 mr-2" />
                Configuración
              </DropdownMenuItem>}
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem className="text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer focus:bg-red-500/10 focus:text-red-300" onClick={handleLogout}>
              Cerrar Sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>;
};