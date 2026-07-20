import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Wallet } from 'lucide-react';
import DatePickerInput from '@/components/common/DatePickerInput';
import { Invoice } from '@/types';
import { getTodayString } from '@/utils/timezoneUtils';
import { formatCurrency } from '@/lib/utils';
import { createLogger } from "@/lib/logger";


const logger = createLogger("MarkAsPaidModal");
interface MarkAsPaidModalProps {
  invoice: Invoice | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (invoiceId: string, paymentDate: string) => Promise<void>;
}

export const MarkAsPaidModal = ({ invoice, isOpen, onClose, onConfirm }: MarkAsPaidModalProps) => {
  const [paymentDate, setPaymentDate] = useState(getTodayString());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!invoice) return;
    setIsSubmitting(true);
    try {
      await onConfirm(invoice.id, paymentDate);
      onClose();
    } catch (error) {
      logger.error('Error marking as paid:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  // Reset date when modal opens with new invoice
  const handleOpen = () => {
    setPaymentDate(getTodayString());
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="finance-dialog sm:max-w-md" onOpenAutoFocus={handleOpen}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <CheckCircle className="size-5 text-primary" />
            Marcar como Pagada
          </DialogTitle>
        </DialogHeader>

        {invoice && (
          <div className="space-y-4 py-2">
            {/* Invoice info */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
              <div>
                <p className="text-sm text-muted-foreground">Folio</p>
                <p className="font-medium text-foreground">{invoice.folio}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Total</p>
                <Badge className="bg-primary text-primary-foreground text-sm">
                  ${Number(invoice.total).toLocaleString('es-CL')}
                </Badge>
              </div>
            </div>

            {/* IVA a separar para el F29 (débito fiscal de esta factura). */}
            <div className="flex items-center gap-3 rounded-lg border-2 border-primary/50 bg-primary/5 p-3">
              <Wallet className="size-5 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted-foreground">IVA a separar para F29</p>
                <p className="text-lg font-bold text-primary">{formatCurrency(Number(invoice.vat || 0))}</p>
              </div>
            </div>

            {/* Date picker */}
            <div className="space-y-2">
              <Label htmlFor="payment-date" className="text-foreground">
                Fecha de Pago
              </Label>
              <DatePickerInput
                id="payment-date"
                value={paymentDate}
                onChange={setPaymentDate}
                placeholder="Seleccionar fecha de pago"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting || !paymentDate}
            className="bg-primary hover:bg-primary/90"
          >
            {isSubmitting ? 'Procesando...' : 'Confirmar Pago'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
