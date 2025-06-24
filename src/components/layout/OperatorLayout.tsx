
import React from 'react';
import { Outlet } from 'react-router-dom';
import { Construction, User, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/components/ui/custom-toast';

export const OperatorLayout = () => {
  const { user, logout } = useUser();
  const { toast } = useToast();

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

  return (
    <div className="min-h-screen bg-gradient-tms">
      {/* Header */}
      <header className="bg-black/20 backdrop-blur-lg border-b border-gray-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-tms-green rounded-lg flex items-center justify-center">
              <Construction className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">TMS Grúas</h1>
              <p className="text-xs text-gray-400">Panel del Operador</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-white">
              <User className="w-4 h-4" />
              <span className="text-sm">{user?.name}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Salir
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 sm:p-6">
        <Outlet />
      </main>
    </div>
  );
};
