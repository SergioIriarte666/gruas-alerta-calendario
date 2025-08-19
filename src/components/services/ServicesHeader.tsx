
import { Button } from '@/components/ui/button';
import { Plus, Upload, RefreshCw, FileDown } from 'lucide-react';
import { GlobalRefreshButton } from './GlobalRefreshButton';

interface ServicesHeaderProps {
  isAdmin: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onCSVUpload: () => void;
  onNewService: () => void;
  onExportPending: () => void;
  isExportingPending: boolean;
  pendingServicesCount: number;
}

export const ServicesHeader = ({ 
  isAdmin, 
  refreshing, 
  onRefresh, 
  onCSVUpload, 
  onNewService,
  onExportPending,
  isExportingPending,
  pendingServicesCount
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
        <GlobalRefreshButton />
        {isAdmin && (
          <>
            <Button 
              onClick={onExportPending}
              disabled={isExportingPending || pendingServicesCount === 0}
              variant="outline"
              className="border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100 disabled:opacity-50"
              title={pendingServicesCount === 0 ? "No hay servicios pendientes" : "Exportar servicios pendientes a PDF"}
            >
              <FileDown className={`w-4 h-4 mr-2 ${isExportingPending ? 'animate-bounce' : ''}`} />
              Exportar Pendientes ({pendingServicesCount})
            </Button>
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
