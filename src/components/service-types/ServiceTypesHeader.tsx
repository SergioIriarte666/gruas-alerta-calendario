import { Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';

interface ServiceTypesHeaderProps {
  onNewServiceType: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}

export const ServiceTypesHeader = ({ onNewServiceType, onRefresh, refreshing }: ServiceTypesHeaderProps) => {
  const isMobile = useIsMobile();
  
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
      <div>
        <h1 className={`${isMobile ? 'text-xl' : 'text-3xl'} font-bold text-foreground`}>Tipos de Servicio</h1>
        <p className="text-muted-foreground mt-1 text-sm">Gestiona los tipos de servicio y sus configuraciones</p>
      </div>
      <div className="flex gap-2">
        <Button
          onClick={onRefresh}
          variant="outline"
          size="sm"
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 ${!isMobile ? 'mr-2' : ''} ${refreshing ? 'animate-spin' : ''}`} />
          {!isMobile && 'Actualizar'}
        </Button>
        <Button 
          onClick={onNewServiceType} 
          size="sm"
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
        >
          <Plus className="h-4 w-4 mr-1" />
          Nuevo Tipo
        </Button>
      </div>
    </div>
  );
};