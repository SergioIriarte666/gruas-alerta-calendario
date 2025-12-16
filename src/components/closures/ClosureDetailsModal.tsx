import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { ServiceClosure } from '@/types';
import { 
  FileText,
  Calendar,
  User,
  DollarSign,
  Package
} from 'lucide-react';
import { formatForDisplayWithTime, formatForDisplay } from '@/utils/timezoneUtils';

interface ClosureDetailsModalProps {
  closure: ServiceClosure | null;
  clientName?: string;
  isOpen: boolean;
  onClose: () => void;
}

const getStatusBadge = (status: string) => {
  const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    open: { label: 'Abierto', variant: 'secondary' },
    closed: { label: 'Cerrado', variant: 'default' },
    invoiced: { label: 'Facturado', variant: 'default' },
    quoted: { label: 'Cotizado', variant: 'outline' },
    purchase_order_pending: { label: 'OC Pendiente', variant: 'secondary' }
  };
  
  const config = statusConfig[status] || { label: status, variant: 'secondary' as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
};

export const ClosureDetailsModal = ({ closure, clientName, isOpen, onClose }: ClosureDetailsModalProps) => {
  if (!closure) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Cierre {closure.folio}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Estado */}
          <div className="flex items-center gap-2">
            {getStatusBadge(closure.status)}
          </div>

          {/* Información Principal */}
          <div className="grid grid-cols-2 gap-4">
            {clientName && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Cliente</span>
                </div>
                <p className="text-sm">{clientName}</p>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Período</span>
              </div>
              <p className="text-sm">
                {formatForDisplay(closure.dateRange.from)} - {formatForDisplay(closure.dateRange.to)}
              </p>
            </div>
          </div>

          {/* Información Financiera */}
          <div className="bg-muted/50 p-4 rounded-lg space-y-3">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">Información Financiera</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Total</p>
                <p className="font-medium text-lg text-violet-600">{formatCurrency(closure.total)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Servicios Incluidos</p>
                <p className="font-medium">{closure.serviceIds.length}</p>
              </div>
            </div>
          </div>

          {/* Orden de Compra */}
          {closure.purchaseOrder && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Orden de Compra</span>
              </div>
              <p className="text-sm">{closure.purchaseOrder}</p>
            </div>
          )}

          {/* Footer con información de creación */}
          <div className="flex justify-between text-sm text-muted-foreground pt-4 border-t">
            <span>
              Creado: {formatForDisplayWithTime(closure.createdAt)}
              {closure.creatorName && ` por ${closure.creatorName}`}
            </span>
            <span>Actualizado: {formatForDisplayWithTime(closure.updatedAt)}</span>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
