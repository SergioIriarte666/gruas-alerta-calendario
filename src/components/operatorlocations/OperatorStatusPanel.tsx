import { Badge } from '@/components/ui/badge';
import { businessClock } from '@/utils/businessClock';
import {
  OPERATOR_STATUS_LABELS,
  deriveOperatorStatus,
  formatMinutesAgo,
  type OperatorLiveLocation,
  type OperatorLiveStatus,
} from '@/types/operatorLocations';
import { cn } from '@/lib/utils';

const STATUS_BADGE_CLASS: Record<OperatorLiveStatus, string> = {
  en_servicio: 'border-info/30 bg-info/10 text-info',
  en_jornada: 'border-success/30 bg-success/10 text-success',
  manual: 'border-border bg-muted text-muted-foreground',
  sin_senal: 'border-warning/30 bg-warning/10 text-warning',
  pausado: 'border-border bg-muted text-muted-foreground',
  fuera_jornada: 'border-border bg-muted text-muted-foreground',
  inactivo: 'border-border bg-muted text-muted-foreground',
};

interface OperatorStatusPanelProps {
  locations: OperatorLiveLocation[];
  selectedOperatorId?: string | null;
  onSelectOperator: (operatorId: string) => void;
}

export const OperatorStatusPanel = ({
  locations,
  selectedOperatorId,
  onSelectOperator,
}: OperatorStatusPanelProps) => {
  const sorted = [...locations].sort((a, b) => a.operator_name.localeCompare(b.operator_name));

  return (
    <div className="flex flex-col gap-2">
      {sorted.length === 0 && (
        <p className="resources-panel p-4 text-center text-sm text-muted-foreground">
          No hay operadores activos
        </p>
      )}

      {sorted.map((location) => {
        const status = deriveOperatorStatus(location);
        const isSelected = location.operator_id === selectedOperatorId;

        return (
          <button
            key={location.operator_id}
            type="button"
            onClick={() => onSelectOperator(location.operator_id)}
            className={cn(
              'w-full rounded-xl border p-3 text-left transition-colors shadow-sm',
              isSelected
                ? 'resource-location-selected'
                : 'border-border bg-card hover:bg-accent/40',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-base font-semibold text-foreground">{location.operator_name}</p>
              <Badge variant="outline" className={cn('shrink-0 text-[11px] font-semibold', STATUS_BADGE_CLASS[status])}>
                {OPERATOR_STATUS_LABELS[status]}
              </Badge>
            </div>
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              Última señal {formatMinutesAgo(location.recorded_at)}
              {location.service_folio ? ` · Folio ${location.service_folio}` : ''}
            </p>
            {status === 'pausado' && location.session_ended_at && (
              <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                Pausó a las {businessClock.format(location.session_ended_at, 'HH:mm')}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
};
