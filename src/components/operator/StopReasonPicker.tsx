import { useState } from 'react';
import {
  Coffee,
  Fuel,
  PauseCircle,
  Ticket,
  TrafficCone,
  UtensilsCrossed,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { STOP_REASON_LABELS, STOP_REASON_ORDER, type StopReason } from '@/types/serviceStopEvent';

export const STOP_REASON_ICONS: Record<StopReason, LucideIcon> = {
  combustible: Fuel,
  alimentacion: UtensilsCrossed,
  descanso: Coffee,
  peaje: Ticket,
  // Cono de faena y llave: se reconocen de un vistazo con el camión detenido en
  // la berma, que es exactamente cuando se usan.
  ruta_cortada: TrafficCone,
  falla_mecanica: Wrench,
  otro: PauseCircle,
};

interface StopReasonPickerProps {
  disabled?: boolean;
  onSelect: (reason: StopReason) => void | Promise<void>;
}

/**
 * "Registrar detención" abre chips de motivo; un toque registra la detención.
 *
 * El rótulo es un VERBO a propósito. Antes decía "Detenido", que se lee como el
 * estado actual de la grúa y no como lo que va a pasar al tocarlo: el operador
 * no podía saber si el botón informaba o accionaba.
 *
 * La transmisión NO se corta al declarar una parada: un vehículo detenido con
 * posición fresca es información buena. Lo que se detiene es el ETA, para no
 * mostrarle al cliente una hora de llegada que corre sola.
 */
export const StopReasonPicker = ({ disabled, onSelect }: StopReasonPickerProps) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(true)}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-muted/60 px-4 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted disabled:opacity-60"
      >
        <PauseCircle className="size-4" />
        Registrar detención
      </button>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Motivo de la detención">
      {STOP_REASON_ORDER.map((reason) => {
        const Icon = STOP_REASON_ICONS[reason];
        return (
          <button
            key={reason}
            type="button"
            disabled={disabled}
            onClick={() => { setIsOpen(false); void onSelect(reason); }}
            className={cn(
              'flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border border-border bg-background px-2 text-center',
              'text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-60',
            )}
          >
            <Icon className="size-5 text-muted-foreground" />
            {STOP_REASON_LABELS[reason]}
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => setIsOpen(false)}
        className="flex min-h-16 items-center justify-center rounded-2xl px-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted"
      >
        Cancelar
      </button>
    </div>
  );
};
