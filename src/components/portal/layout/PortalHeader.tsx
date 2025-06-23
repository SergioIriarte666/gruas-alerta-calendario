
import React from 'react';
import { LogOut, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '@/hooks/useSettings';

const PortalHeader: React.FC = () => {
  const navigate = useNavigate();
  const { settings } = useSettings();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/portal/login');
  };

  const companyName = settings?.company?.name || 'Grúas Alerta';

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
        <button className="flex items-center space-x-2 text-gray-300 hover:text-white">
          <User className="w-5 h-5" />
          <span>Mi Perfil</span>
        </button>
        <button 
          onClick={handleLogout}
          className="flex items-center space-x-2 text-red-400 hover:text-red-300"
        >
          <LogOut className="w-5 h-5" />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </header>
  );
};

export default PortalHeader;
