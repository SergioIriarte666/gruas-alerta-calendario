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
        <h1 className="text-3xl font-bold text-foreground">Tipos de Servicio</h1>
        <p className="text-muted-foreground mt-2">Gestiona los tipos de servicio y sus configuraciones</p>
      </div>
      <div className="flex gap-3">
        <Button
          onClick={onRefresh}
          variant="outline"
          size="sm"
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
        <Button 
          onClick={onNewServiceType} 
          size="sm"
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Tipo
        </Button>
      </div>
    </div>
  );
};