import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { 
  CreditCard,
  Calendar,
  Building,
  DollarSign,
  Clock,
  Download
} from 'lucide-react';
import { formatForDisplayWithTime, formatForDisplay } from '@/utils/timezoneUtils';
import { usePDFGeneration } from '@/hooks/usePDFGeneration';
import {
  generatePaymentReceiptPDF,
  paymentReceiptFileName,
} from '@/utils/pdf/paymentReceiptPdfGenerator';

interface PaymentDetailsModalProps {
  payment: any | null;
  isOpen: boolean;
  onClose: () => void;
}

export const PaymentDetailsModal = ({ payment, isOpen, onClose }: PaymentDetailsModalProps) => {
  const { isGenerating, generateAndDownload } = usePDFGeneration();

  if (!payment) return null;

  const handleDownloadReceipt = () =>
    generateAndDownload(
      async () => ({
        blob: await generatePaymentReceiptPDF(payment.id),
        fileName: paymentReceiptFileName(payment.id),
      }),
      paymentReceiptFileName(payment.id),
    );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="size-5" />
            Pago {formatCurrency(payment.amount)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Estado */}
          <div className="flex items-center gap-2">
            <Badge variant={payment.status === 'pending' ? 'secondary' : 'default'}>
              {payment.status === 'pending' ? 'Pendiente' : 'Programado'}
            </Badge>
          </div>

          {/* Información del Pago */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <DollarSign className="size-4 text-muted-foreground" />
                <span className="font-medium">Monto</span>
              </div>
              <p className="text-sm font-semibold">{formatCurrency(payment.amount)}</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CreditCard className="size-4 text-muted-foreground" />
                <span className="font-medium">Método de Pago</span>
              </div>
              <p className="text-sm">{payment.payment_method || 'N/A'}</p>
            </div>
          </div>

          {/* Información del Proveedor */}
          {payment.supplier_invoice && (
            <div className="bg-muted/50 p-4 rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <Building className="size-4 text-muted-foreground" />
                <span className="font-medium">Información del Proveedor</span>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Proveedor</p>
                  <p className="font-medium">
                    {payment.supplier_invoice.supplier_name ||
                      payment.supplier_invoice.inventory_suppliers?.name ||
                      payment.supplier_invoice.supplier?.name ||
                      'N/A'}
                  </p>
                </div>
                {payment.supplier_invoice.invoice_number && (
                  <div>
                    <p className="text-muted-foreground">Número de Factura</p>
                    <p className="font-medium">{payment.supplier_invoice.invoice_number}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-4">
            {payment.due_date && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="size-4 text-muted-foreground" />
                  <span className="font-medium">Fecha de Vencimiento</span>
                </div>
                <p className="text-sm">{formatForDisplay(payment.due_date)}</p>
              </div>
            )}

            {payment.scheduled_date && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="size-4 text-muted-foreground" />
                  <span className="font-medium">Fecha Programada</span>
                </div>
                <p className="text-sm">{formatForDisplay(payment.scheduled_date)}</p>
              </div>
            )}
          </div>

          {/* Notas */}
          {payment.notes && (
            <div className="space-y-2">
              <span className="font-medium">Notas</span>
              <p className="text-sm text-muted-foreground">{payment.notes}</p>
            </div>
          )}

          {/* Footer con información de creación */}
          {payment.created_at && (
            <div className="flex justify-between text-sm text-muted-foreground pt-4 border-t">
              <span>
                Creado: {formatForDisplayWithTime(payment.created_at)}
                {payment.creator_name && ` por ${payment.creator_name}`}
              </span>
              {payment.updated_at && (
                <span>Actualizado: {formatForDisplayWithTime(payment.updated_at)}</span>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={handleDownloadReceipt}
              disabled={isGenerating}
              className="flex items-center gap-2"
            >
              <Download className="size-4" />
              {isGenerating ? 'Generando...' : 'Descargar Comprobante'}
            </Button>
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
