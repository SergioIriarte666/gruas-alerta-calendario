import { Button } from '@/components/ui/button';
import { FileClock, RefreshCcw } from 'lucide-react';

interface RegenerarInspeccionHeaderProps {
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const RegenerarInspeccionHeader = ({ onRefresh, isRefreshing }: RegenerarInspeccionHeaderProps) => (
  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div className="space-y-1">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
          <FileClock className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Regenerar Inspección</h1>
          <p className="text-sm text-muted-foreground">
            Reemite PDFs desde evidencia guardada y reenvía el documento por WhatsApp.
          </p>
        </div>
      </div>
    </div>
    <Button variant="outline" onClick={onRefresh} disabled={isRefreshing}>
      <RefreshCcw className="mr-2 size-4" />
      {isRefreshing ? 'Actualizando...' : 'Actualizar'}
    </Button>
  </div>
);
