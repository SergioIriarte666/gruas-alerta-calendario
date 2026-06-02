
import React from 'react';
import { LogOut, User } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';
import { useUser } from '@/contexts/UserContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const PortalHeader: React.FC = () => {
  const { settings } = useSettings();
  const { user } = useUser();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    try {
      toast.info('Cerrando sesión...', {
        description: 'Limpiando datos de usuario'
      });
      
      await signOut();
    } catch (error) {
      toast.error('Error al cerrar sesión', {
        description: 'Sesión cerrada forzosamente'
      });
    }
  };

  const companyName = settings?.company?.name || 'Grúas Alerta';
  const userName = user?.name || 'Usuario';

  return (
    <header className="flex items-center justify-between border-b border-border/70 bg-card/95 p-4 backdrop-blur">
      <div className="flex items-center gap-x-3">
        {settings?.company?.logo && (
          <img 
            src={settings.company.logo} 
            alt="Logo empresa" 
            className="size-8 object-contain" 
          />
        )}
        <div>
          <h1 className="text-xl font-bold text-foreground">{companyName}</h1>
          <p className="text-sm text-muted-foreground">Portal de Clientes</p>
        </div>
      </div>
      <div className="flex items-center gap-x-4">
        <div className="flex items-center gap-x-2 text-muted-foreground">
          <User className="size-5 text-primary" />
          <span>Bienvenido, {userName}</span>
        </div>
        <Button
          onClick={handleLogout}
          variant="ghost"
          className="text-danger hover:bg-danger/10 hover:text-danger"
        >
          <LogOut className="size-5" />
          <span>Cerrar Sesión</span>
        </Button>
      </div>
    </header>
  );
};

export default PortalHeader;
