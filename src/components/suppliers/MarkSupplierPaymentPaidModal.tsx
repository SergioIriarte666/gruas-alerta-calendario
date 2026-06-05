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
import { CheckCircle } from 'lucide-react';
import DatePickerInput from '@/components/common/DatePickerInput';
import { SupplierPayment } from '@/types/suppliers';
import { formatCurrency } from '@/lib/utils';
import { getTodayString } from '@/utils/timezoneUtils';

interface MarkSupplierPaymentPaidModalProps {
  payment: SupplierPayment | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (payment: SupplierPayment, paymentDate: string) => void;
}

export const MarkSupplierPaymentPaidModal = ({
  payment,
  isOpen,
  onClose,
  onConfirm,
}: MarkSupplierPaymentPaidModalProps) => {
  const [paymentDate, setPaymentDate] = useState(getTodayString());

  const handleOpenChange = (open: boolean) => {
    if (!open) onClose();
  };

  const handleConfirm = () => {
    if (!payment) return;
    onConfirm(payment, paymentDate);
    onClose();
  };

  // Reset date when modal opens
  const handleOpen = () => {
    setPaymentDate(getTodayString());
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" onOpenAutoFocus={handleOpen}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <CheckCircle className="size-5 text-primary" />
            Marcar como Pagado
          </DialogTitle>
        </DialogHeader>

        {payment && (
          <div className="space-y-4 py-2">
            {/* Payment info */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
              <div>
                <p className="text-sm text-muted-foreground">Descripción</p>
                <p className="font-medium text-foreground">{payment.description}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Monto</p>
                <Badge className="bg-primary text-primary-foreground text-sm">
                  {formatCurrency(payment.amount)}
                </Badge>
              </div>
            </div>

            {/* Date picker */}
            <div className="space-y-2">
              <Label htmlFor="supplier-payment-date" className="text-foreground">
                Fecha de Pago
              </Label>
              <DatePickerInput
                id="supplier-payment-date"
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
            disabled={!paymentDate}
            className="bg-primary hover:bg-primary/90"
          >
            Confirmar Pago
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
