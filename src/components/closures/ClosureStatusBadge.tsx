import { Badge } from '@/components/ui/badge';
import type { ClosureStatus } from '@/types';

const CLOSURE_STATUS_CONFIG: Record<ClosureStatus, { label: string; className: string }> = {
  open: { label: 'Abierto', className: 'border-warning/30 bg-warning/10 text-warning' },
  closed: { label: 'Cerrado', className: 'border-info/30 bg-info/10 text-info' },
  invoiced: { label: 'Facturado', className: 'border-success/30 bg-success/10 text-success' },
  quoted: { label: 'Cotizado', className: 'border-border/70 bg-muted/40 text-muted-foreground' },
  purchase_order_pending: { label: 'OC Pendiente', className: 'border-border/70 bg-muted/40 text-muted-foreground' },
};

interface ClosureStatusBadgeProps {
  status: ClosureStatus;
}

export const ClosureStatusBadge = ({ status }: ClosureStatusBadgeProps) => {
  const config = CLOSURE_STATUS_CONFIG[status] ?? {
    label: 'Desconocido',
    className: 'border-border/70 bg-muted/40 text-muted-foreground',
  };
  return <Badge className={config.className}>{config.label}</Badge>;
};

export default ClosureStatusBadge;
