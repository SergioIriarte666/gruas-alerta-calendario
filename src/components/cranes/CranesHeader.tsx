import { Button } from '@/components/ui/button';
import { Plus, Truck } from 'lucide-react';

interface CranesHeaderProps {
  onNewCrane: () => void;
}

export const CranesHeader = ({ onNewCrane }: CranesHeaderProps) => {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <span className="dashboard-section-kicker"><Truck className="size-3.5" />Parque de equipos</span>
        <h1 className="dashboard-section-title">Grúas</h1>
        <p className="dashboard-section-description">Flota, vigencias documentales y disponibilidad operativa.</p>
      </div>
      <Button onClick={onNewCrane} size="sm" className="dashboard-report-button">
        <Plus className="mr-2 size-4" />
        Nueva grúa
      </Button>
    </div>
  );
};
