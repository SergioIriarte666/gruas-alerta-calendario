import React from 'react';
import { LogOut, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

const PortalHeader: React.FC = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/portal/login');
  };

  return (
    <header className="bg-gray-800/50 backdrop-blur-sm p-4 flex justify-between items-center border-b border-gray-700">
      <div>
        <h1 className="text-xl font-bold text-white">Portal de Cliente</h1>
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
