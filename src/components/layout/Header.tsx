
import { Menu, Search, User, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useUser } from '@/contexts/UserContext';
import { NotificationsDropdown } from './NotificationsDropdown';

interface HeaderProps {
  setIsMobileMenuOpen: (open: boolean) => void;
}

export const Header = ({ setIsMobileMenuOpen }: HeaderProps) => {
  const navigate = useNavigate();
  const { user, logout } = useUser();
  const isAdmin = user?.role === 'admin';

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Sesión cerrada", {
        description: "Has cerrado sesión correctamente",
      });
      window.location.href = '/auth';
    } catch (error) {
      console.error("Logout failed:", error);
      toast.error("Error al cerrar sesión", {
        description: "Por favor, intenta de nuevo."
      });
    }
  };

  const handleProfileClick = () => {
    navigate('/profile');
  };

  return (
    <header className="flex h-16 items-center justify-between bg-black/20 backdrop-blur-lg border-b border-gray-800 px-4 sm:px-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden text-gray-300 hover:text-white"
          onClick={() => setIsMobileMenuOpen(true)}
        >
          <Menu className="h-6 w-6" />
          <span className="sr-only">Abrir menú</span>
        </Button>
        
        {/* Search */}
        <div className="hidden lg:block relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Buscar servicios, clientes, facturas..."
            className="pl-10 bg-white/5 border-gray-700 text-white placeholder-gray-400 focus:border-tms-green"
          />
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center space-x-2 sm:space-x-4">
        {/* Notifications */}
        <NotificationsDropdown />

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-gray-300 hover:text-white rounded-full">
              <User className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="end" 
            className="bg-tms-dark border-gray-700 min-w-[200px] z-50"
          >
            <DropdownMenuLabel className="text-white font-semibold">
              {user?.name || 'Mi Cuenta'}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-gray-700" />
            <DropdownMenuItem 
              className="text-gray-300 hover:text-white hover:bg-white/10 cursor-pointer focus:bg-white/10 focus:text-white"
              onClick={handleProfileClick}
            >
              <User className="w-4 h-4 mr-2" />
              Perfil
            </DropdownMenuItem>
            {isAdmin && (
              <DropdownMenuItem 
                className="text-gray-300 hover:text-white hover:bg-white/10 cursor-pointer focus:bg-white/10 focus:text-white"
                onClick={() => navigate('/settings')}
              >
                <Settings className="w-4 h-4 mr-2" />
                Configuración
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator className="bg-gray-700" />
            <DropdownMenuItem 
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer focus:bg-red-500/10 focus:text-red-300"
              onClick={handleLogout}
            >
              Cerrar Sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
