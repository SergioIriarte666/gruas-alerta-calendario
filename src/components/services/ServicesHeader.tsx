
import { Button } from '@/components/ui/button';
import { Plus, Upload, RefreshCw } from 'lucide-react';

interface ServicesHeaderProps {
  isAdmin: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onCSVUpload: () => void;
  onNewService: () => void;
}

export const ServicesHeader = ({ 
  isAdmin, 
  refreshing, 
  onRefresh, 
  onCSVUpload, 
  onNewService 
}: ServicesHeaderProps) => {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold text-white">Gestión de Servicios</h1>
        <p className="text-gray-400 mt-2">
          Administra todos los servicios de grúa del sistema
        </p>
      </div>
      <div className="flex space-x-2">
        <Button 
          onClick={onRefresh}
          disabled={refreshing}
          variant="outline"
          className="border-gray-400/50 bg-gray-400/10 text-gray-300 hover:bg-gray-400/20 hover:border-gray-400"
          title="Actualizar datos"
          style={{
            borderColor: 'rgba(156, 163, 175, 0.5)',
            backgroundColor: 'rgba(156, 163, 175, 0.1)',
            color: '#d1d5db'
          }}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
        {isAdmin && (
          <>
            <Button 
              onClick={onCSVUpload}
              variant="outline"
              className="border-blue-500/50 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:border-blue-500"
              title="Cargar servicios desde un archivo CSV"
              style={{
                borderColor: 'rgba(59, 130, 246, 0.5)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                color: '#3b82f6'
              }}
            >
              <Upload className="w-4 h-4 mr-2" />
              Carga Masiva
            </Button>
            <Button 
              className="bg-tms-green hover:bg-tms-green/80 text-black font-medium"
              title="Crear un nuevo servicio"
              onClick={onNewService}
              style={{
                backgroundColor: '#9cfa24',
                color: '#000000'
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Servicio
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
