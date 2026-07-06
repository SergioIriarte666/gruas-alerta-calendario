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
  en_servicio: 'border-cyan-200 bg-cyan-50 text-cyan-800',
  en_jornada: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  manual: 'border-slate-200 bg-slate-100 text-slate-700',
  sin_senal: 'border-amber-200 bg-amber-50 text-amber-800',
  pausado: 'border-slate-200 bg-slate-100 text-slate-700',
  fuera_jornada: 'border-slate-200 bg-slate-100 text-slate-700',
  inactivo: 'border-slate-200 bg-slate-100 text-slate-700',
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
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-center text-sm text-slate-600 shadow-sm">
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
                ? 'border-cyan-300 bg-cyan-50'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-base font-semibold text-slate-900">{location.operator_name}</p>
              <Badge variant="outline" className={cn('shrink-0 text-[11px] font-semibold', STATUS_BADGE_CLASS[status])}>
                {OPERATOR_STATUS_LABELS[status]}
              </Badge>
            </div>
            <p className="mt-1 text-sm font-medium text-slate-700">
              Última señal {formatMinutesAgo(location.recorded_at)}
              {location.service_folio ? ` · Folio ${location.service_folio}` : ''}
            </p>
            {status === 'pausado' && location.session_ended_at && (
              <p className="mt-0.5 text-xs font-medium text-slate-600">
                Pausó a las {businessClock.format(location.session_ended_at, 'HH:mm')}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
};
