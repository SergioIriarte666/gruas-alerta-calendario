import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { 
  FileText,
  Calendar,
  User,
  DollarSign,
  Clock,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';

interface InvoiceDetailsModalProps {
  invoice: any | null;
  isOpen: boolean;
  onClose: () => void;
}

export const InvoiceDetailsModal = ({ invoice, isOpen, onClose }: InvoiceDetailsModalProps) => {
  if (!invoice) return null;

  const isOverdue = new Date(invoice.due_date) < new Date();
  const pendingAmount = invoice.total - (invoice.paid_amount || 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Factura {invoice.folio}
            {isOverdue && <AlertTriangle className="w-5 h-5 text-red-500" />}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Estado */}
          <div className="flex items-center gap-2">
            <Badge variant={isOverdue ? 'destructive' : pendingAmount > 0 ? 'secondary' : 'default'}>
              {isOverdue ? 'Vencida' : pendingAmount > 0 ? 'Pendiente' : 'Pagada'}
            </Badge>
            {pendingAmount <= 0 && <CheckCircle className="w-4 h-4 text-green-500" />}
          </div>

          {/* Información del Cliente */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Cliente</span>
              </div>
              <p className="text-sm">{invoice.client?.name || 'N/A'}</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Fecha de Vencimiento</span>
              </div>
              <p className="text-sm">{invoice.due_date}</p>
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
                <p className="font-medium">{formatCurrency(invoice.total)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Pagado</p>
                <p className="font-medium">{formatCurrency(invoice.paid_amount || 0)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Pendiente</p>
                <p className="font-medium text-orange-600">{formatCurrency(pendingAmount)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Estado</p>
                <p className={`font-medium ${isOverdue ? 'text-red-600' : pendingAmount > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  {isOverdue ? 'Vencida' : pendingAmount > 0 ? 'Pendiente' : 'Pagada'}
                </p>
              </div>
            </div>
          </div>

          {/* Información Adicional */}
          {invoice.notes && (
            <div className="space-y-2">
              <span className="font-medium">Notas</span>
              <p className="text-sm text-muted-foreground">{invoice.notes}</p>
            </div>
          )}

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