import { Button } from '@/components/ui/button';
import { FileClock, RefreshCcw } from 'lucide-react';

interface RegenerarInspeccionHeaderProps {
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const RegenerarInspeccionHeader = ({ onRefresh, isRefreshing }: RegenerarInspeccionHeaderProps) => (
  <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
    <div className="space-y-1">
      <div>
        <span className="dashboard-section-kicker"><FileClock className="size-3.5" />Continuidad documental</span>
        <div>
          <h1 className="dashboard-section-title">Regenerar Inspección</h1>
          <p className="dashboard-section-description">Reemisión de PDF desde evidencia guardada y reenvío por WhatsApp.</p>
        </div>
      </div>
    </div>
    <Button variant="outline" onClick={onRefresh} disabled={isRefreshing}>
      <RefreshCcw className="mr-2 size-4" />
      {isRefreshing ? 'Actualizando...' : 'Actualizar'}
    </Button>
  </div>
);
