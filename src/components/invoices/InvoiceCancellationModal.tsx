import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, Ban, FileText, Building2, DollarSign } from 'lucide-react';
import { Invoice } from '@/types';
import { useInvoiceCancellation, CANCELLATION_REASONS } from '@/hooks/invoices/useInvoiceCancellation';

interface InvoiceCancellationModalProps {
  invoice: Invoice | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  getClientName: (invoice: Invoice) => string;
}

export const InvoiceCancellationModal = ({
  invoice,
  isOpen,
  onClose,
  onSuccess,
  getClientName,
}: InvoiceCancellationModalProps) => {
  const [creditNoteNumber, setCreditNoteNumber] = useState('');
  const [cancellationReason, setCancellationReason] = useState('');
  const [reasonDetails, setReasonDetails] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { cancelInvoice } = useInvoiceCancellation();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleSubmit = async () => {
    if (!invoice || !creditNoteNumber.trim() || !cancellationReason || !confirmed) {
      return;
    }

    setIsSubmitting(true);
    try {
      await cancelInvoice({
        invoiceId: invoice.id,
        creditNoteNumber: creditNoteNumber.trim(),
        cancellationReason,
        reasonDetails: reasonDetails.trim() || undefined,
      });
      
      // Reset form
      setCreditNoteNumber('');
      setCancellationReason('');
      setReasonDetails('');
      setConfirmed(false);
      
      onSuccess();
      onClose();
    } catch (error) {
      // Error is handled in the hook
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setCreditNoteNumber('');
      setCancellationReason('');
      setReasonDetails('');
      setConfirmed(false);
      onClose();
    }
  };

  const isValid = creditNoteNumber.trim() && cancellationReason && confirmed;

  if (!invoice) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Ban className="h-5 w-5" />
            Anular Factura con Nota de Crédito
          </DialogTitle>
          <DialogDescription>
            Esta acción registrará la anulación contable de la factura.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Invoice Info */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Factura:</span>
              <span>{invoice.folio}</span>
              {invoice.numeroFiscal && (
                <span className="text-violet-600 font-medium">({invoice.numeroFiscal})</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Cliente:</span>
              <span>{getClientName(invoice)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Total:</span>
              <span className="text-lg font-semibold">{formatCurrency(invoice.total)}</span>
            </div>
          </div>

          {/* Credit Note Number */}
          <div className="space-y-2">
            <Label htmlFor="creditNoteNumber" className="text-sm font-medium">
              Número de Nota de Crédito <span className="text-destructive">*</span>
            </Label>
            <Input
              id="creditNoteNumber"
              value={creditNoteNumber}
              onChange={(e) => setCreditNoteNumber(e.target.value)}
              placeholder="Ej: NC-00001234"
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              Este número debe coincidir con el documento emitido en el SII
            </p>
          </div>

          {/* Cancellation Reason */}
          <div className="space-y-2">
            <Label htmlFor="cancellationReason" className="text-sm font-medium">
              Motivo de Anulación <span className="text-destructive">*</span>
            </Label>
            <Select value={cancellationReason} onValueChange={setCancellationReason} disabled={isSubmitting}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar motivo..." />
              </SelectTrigger>
              <SelectContent>
                {CANCELLATION_REASONS.map((reason) => (
                  <SelectItem key={reason.value} value={reason.value}>
                    {reason.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Additional Details */}
          <div className="space-y-2">
            <Label htmlFor="reasonDetails" className="text-sm font-medium">
              Detalle adicional {cancellationReason === 'otro' && <span className="text-destructive">*</span>}
            </Label>
            <Textarea
              id="reasonDetails"
              value={reasonDetails}
              onChange={(e) => setReasonDetails(e.target.value)}
              placeholder="Descripción detallada del motivo de anulación..."
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          {/* Warning */}
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
            <div className="flex gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800 dark:text-amber-200">
                <p className="font-medium mb-1">Esta acción:</p>
                <ul className="list-disc list-inside space-y-0.5 text-xs">
                  <li>Cambiará el estado de la factura a "Anulada"</li>
                  <li>Los servicios quedarán disponibles para nueva factura</li>
                  <li>Se registrará el monto como rebaja contable</li>
                  <li><strong>NO se puede deshacer</strong></li>
                </ul>
              </div>
            </div>
          </div>

          {/* Confirmation Checkbox */}
          <div className="flex items-start gap-3 bg-muted/30 rounded-lg p-3 border">
            <Checkbox
              id="confirmed"
              checked={confirmed}
              onCheckedChange={(checked) => setConfirmed(checked === true)}
              disabled={isSubmitting}
              className="mt-0.5"
            />
            <Label htmlFor="confirmed" className="text-sm cursor-pointer leading-relaxed">
              Confirmo que la Nota de Crédito ha sido emitida en el sistema del SII y los datos ingresados son correctos.
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? 'Procesando...' : 'Anular Factura'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
