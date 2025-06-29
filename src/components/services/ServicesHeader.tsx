
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
    <div className="flex items-center justify-between bg-white p-6 rounded-lg border">
      <div>
        <h1 className="text-3xl font-bold text-black">Gestión de Servicios</h1>
        <p className="text-gray-600 mt-2">
          Administra todos los servicios de grúa del sistema
        </p>
      </div>
      <div className="flex space-x-2">
        <Button 
          onClick={onRefresh}
          disabled={refreshing}
          variant="outline"
          className="border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          title="Actualizar datos"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
        {isAdmin && (
          <>
            <Button 
              onClick={onCSVUpload}
              variant="outline"
              className="border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
              title="Cargar servicios desde un archivo CSV"
            >
              <Upload className="w-4 h-4 mr-2" />
              Carga Masiva
            </Button>
            <Button 
              className="bg-tms-green hover:bg-tms-green/80 text-black font-medium"
              title="Crear un nuevo servicio"
              onClick={onNewService}
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
