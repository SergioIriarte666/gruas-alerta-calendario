import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  SALE_STATUS_LABEL,
  SALE_TYPE_LABEL,
  type LowboySaleStatus,
  type LowboySaleType,
} from '@/types/lowboySales';

// Colores del pipeline compartidos por la tabla y el modal de detalle (fuente única).
export const STATUS_BADGE: Record<LowboySaleStatus, string> = {
  confirmada: 'bg-sky-600 hover:bg-sky-700 lowboy-on-color',
  ejecutada: 'bg-amber-500 hover:bg-amber-600 lowboy-on-color',
  facturada: 'bg-cyan-800 hover:bg-cyan-900 lowboy-on-color',
  pagada: 'bg-emerald-600 hover:bg-emerald-700 lowboy-on-color',
  cancelada: 'bg-muted text-muted-foreground line-through',
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const key = status as LowboySaleStatus;
  return (
    <Badge className={cn('whitespace-nowrap font-medium', STATUS_BADGE[key] ?? 'bg-muted', className)}>
      {SALE_STATUS_LABEL[key] ?? status}
    </Badge>
  );
}

export function TypeBadge({ type }: { type: string }) {
  const key = type as LowboySaleType;
  return (
    <Badge
      variant="outline"
      className={cn(
        'whitespace-nowrap font-normal',
        key === 'flete' ? 'border-indigo-400 text-indigo-600' : 'border-teal-400 text-teal-600',
      )}
    >
      {SALE_TYPE_LABEL[key] ?? type}
    </Badge>
  );
}
