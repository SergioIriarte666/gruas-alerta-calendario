import { Plus, RefreshCw, Tags } from 'lucide-react';
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
    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <span className="dashboard-section-kicker"><Tags className="size-3.5" />Catálogo operacional</span>
        <h1 className="dashboard-section-title">Tipos de Servicio</h1>
        <p className="dashboard-section-description">Definiciones, requisitos y comportamiento de cada servicio.</p>
      </div>
      <div className="flex gap-2">
        <Button
          onClick={onRefresh}
          variant="outline"
          size="sm"
          disabled={refreshing}
        >
          <RefreshCw className={`size-4 ${!isMobile ? 'mr-2' : ''} ${refreshing ? 'animate-spin' : ''}`} />
          {!isMobile && 'Actualizar'}
        </Button>
        <Button 
          onClick={onNewServiceType} 
          size="sm"
          className="dashboard-report-button font-medium"
        >
          <Plus className="size-4 mr-1" />
          Nuevo Tipo
        </Button>
      </div>
    </div>
  );
};
