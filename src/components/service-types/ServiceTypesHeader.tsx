
import { Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ServiceTypesHeaderProps {
  onNewServiceType: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}

export const ServiceTypesHeader = ({ onNewServiceType, onRefresh, refreshing }: ServiceTypesHeaderProps) => {
  return (
    <div className="flex justify-between items-center">
      <div>
        <h1 className="text-3xl font-bold text-white">Tipos de Servicio</h1>
        <p className="text-gray-400 mt-2">Gestiona los tipos de servicio y sus configuraciones</p>
      </div>
      <div className="flex gap-3">
        <Button
          onClick={onRefresh}
          variant="outline"
          size="sm"
          disabled={refreshing}
          className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
        <Button onClick={onNewServiceType} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Tipo
        </Button>
      </div>
    </div>
  );
};
