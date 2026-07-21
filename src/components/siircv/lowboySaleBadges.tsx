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
  confirmada: 'bg-primary text-primary-foreground hover:bg-primary/90',
  ejecutada: 'bg-warning text-warning-foreground hover:bg-warning/90',
  facturada: 'bg-info text-info-foreground hover:bg-info/90',
  pagada: 'bg-success text-success-foreground hover:bg-success/90',
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
        key === 'flete' ? 'border-info/40 text-info' : 'border-primary/40 text-primary',
      )}
    >
      {SALE_TYPE_LABEL[key] ?? type}
    </Badge>
  );
}
