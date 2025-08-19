
import React from 'react';
import { LogOut, User } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';
import { useUser } from '@/contexts/UserContext';
import { toast } from 'sonner';
import { cleanupAuthState } from '@/utils/authCleanup';

const PortalHeader: React.FC = () => {
  const { settings } = useSettings();
  const { user, logout } = useUser();

  const handleLogout = async () => {
    try {
      console.log('Portal: Logout initiated...');
      
      toast.info('Cerrando sesión...', {
        description: 'Limpiando datos de usuario'
      });
      
      // Use the improved logout from UserContext
      await logout();
    } catch (error) {
      console.error('PortalHeader: Error during logout:', error);
      
      toast.error('Error al cerrar sesión', {
        description: 'Sesión cerrada forzosamente'
      });
      
      // Forzar redirección como último recurso
      cleanupAuthState();
      window.location.href = '/auth';
    }
  };

  const companyName = settings?.company?.name || 'Grúas Alerta';
  const userName = user?.name || 'Usuario';

  return (
    <header className="bg-gray-800/50 backdrop-blur-sm p-4 flex justify-between items-center border-b border-gray-700">
      <div className="flex items-center space-x-3">
        {settings?.company?.logo && (
          <img 
            src={settings.company.logo} 
            alt="Logo empresa" 
            className="h-8 w-8 object-contain" 
          />
        )}
        <div>
          <h1 className="text-xl font-bold text-white">{companyName}</h1>
          <p className="text-sm text-gray-400">Portal de Clientes</p>
        </div>
      </div>
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2 text-gray-300">
          <User className="w-5 h-5" />
          <span>Bienvenido, {userName}</span>
        </div>
        <button 
          onClick={handleLogout}
          className="flex items-center space-x-2 text-red-400 hover:text-red-300 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </header>
  );
};

export default PortalHeader;
