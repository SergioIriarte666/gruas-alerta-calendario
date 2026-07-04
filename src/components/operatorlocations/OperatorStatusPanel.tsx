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
  en_servicio: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  en_jornada: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  manual: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300',
  sin_senal: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  pausado: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300',
  fuera_jornada: 'border-slate-500/30 bg-slate-500/10 text-slate-300',
  inactivo: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300',
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
        <p className="rounded-xl border border-white/5 bg-zinc-950/35 p-4 text-center text-sm text-zinc-500">
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
              'w-full rounded-xl border p-3 text-left transition-colors',
              isSelected
                ? 'border-cyan-500/40 bg-cyan-500/10'
                : 'border-white/5 bg-zinc-950/35 hover:border-white/10 hover:bg-zinc-900/60',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-medium text-white">{location.operator_name}</p>
              <Badge variant="outline" className={cn('shrink-0 text-[11px]', STATUS_BADGE_CLASS[status])}>
                {OPERATOR_STATUS_LABELS[status]}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              Última señal {formatMinutesAgo(location.recorded_at)}
              {location.service_folio ? ` · Folio ${location.service_folio}` : ''}
            </p>
            {status === 'pausado' && location.session_ended_at && (
              <p className="mt-0.5 text-xs text-zinc-500">
                Pausó a las {businessClock.format(location.session_ended_at, 'HH:mm')}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
};
