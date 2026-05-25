import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Invoice } from '@/types';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { ShieldAlert } from 'lucide-react';

interface BatchEditHistoricalInvoicesModalProps {
  selectedInvoices: Invoice[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, updates: Partial<Invoice>) => Promise<void>;
}

const METADATA_SEPARATOR = '\n\n--- METADATA (SISTEMA) ---\n';

interface InvoiceMetadata {
  shippingInfo?: string;
  paymentMethod?: string;
  auditLog?: Array<{
    date: string;
    action: string;
    details: string;
  }>;
}

export const BatchEditHistoricalInvoicesModal = ({
  selectedInvoices,
  isOpen,
  onClose,
  onSave,
}: BatchEditHistoricalInvoicesModalProps) => {
  const [status, setStatus] = useState<string>('');
  const [shippingInfo, setShippingInfo] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [appendNote, setAppendNote] = useState<string>('');
  const [productServiceDescription, setProductServiceDescription] = useState<string>('');
  
  // Flags to know which fields to update
  const [updateStatus, setUpdateStatus] = useState(false);
  const [updateShipping, setUpdateShipping] = useState(false);
  const [updatePayment, setUpdatePayment] = useState(false);
  const [updateNote, setUpdateNote] = useState(false);
  const [updateOrigin, setUpdateOrigin] = useState(false);
  const [updateProductServiceDescription, setUpdateProductServiceDescription] = useState(false);
  const [origin, setOrigin] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const systemInvoiceCount = useMemo(
    () => selectedInvoices.filter(inv => !inv.folio.startsWith('HIST-')).length,
    [selectedInvoices]
  );
  const hasSystemInvoices = systemInvoiceCount > 0;

  const resetForm = () => {
    setStatus('');
    setShippingInfo('');
    setPaymentMethod('');
    setAppendNote('');
    setProductServiceDescription('');
    setUpdateStatus(false);
    setUpdateShipping(false);
    setUpdatePayment(false);
    setUpdateNote(false);
    setUpdateOrigin(false);
    setUpdateProductServiceDescription(false);
    setOrigin('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSave = async () => {
    if (selectedInvoices.length === 0) return;

    setIsSubmitting(true);
    const total = selectedInvoices.length;
    let processed = 0;

    try {
      const trimmedDescription = productServiceDescription.trim();
      if (updateProductServiceDescription) {
        if (trimmedDescription.length < 10 || trimmedDescription.length > 500) {
          toast.error('La descripción debe tener entre 10 y 500 caracteres');
          setIsSubmitting(false);
          return;
        }
      }

      const promises = selectedInvoices.map(async (invoice) => {
        const updates: any = {};
        const changes: string[] = [];
        const isSystem = !invoice.folio.startsWith('HIST-');

        // 1. Status Update — skip for system invoices
        if (updateStatus && status && !isSystem) {
          updates.status = status;
          changes.push(`Status: ${invoice.status} -> ${status}`);
        }

        // 2. Metadata Updates (Shipping, Payment) & Notes
        // We need to parse existing metadata first to preserve other fields
        let currentMetadata: InvoiceMetadata = {};
        let userNotes = invoice.notes || '';

        if (userNotes.includes(METADATA_SEPARATOR)) {
          const parts = userNotes.split(METADATA_SEPARATOR);
          userNotes = parts[0];
          try {
            currentMetadata = JSON.parse(parts[1]);
          } catch (e) {
            console.error('Error parsing metadata for invoice', invoice.folio, e);
          }
        }

        let metadataChanged = false;

        if (updateShipping) {
          currentMetadata.shippingInfo = shippingInfo;
          changes.push(`Shipping Info updated`);
          metadataChanged = true;
        }

        if (updatePayment) {
          currentMetadata.paymentMethod = paymentMethod;
          changes.push(`Payment Method updated`);
          metadataChanged = true;
        }

        // Origin update — skip for system invoices
        if (updateOrigin && origin && !isSystem) {
          const currentOrigin = invoice.folio.startsWith('HIST-') ? 'importada' : 'sistema';
          if (currentOrigin !== origin) {
            if (origin === 'sistema') {
              updates.folio = invoice.folio.replace(/^HIST-(F|NC|ND)-/, '');
            } else {
              updates.folio = invoice.folio.startsWith('HIST-') ? invoice.folio : `HIST-F-${invoice.folio}`;
            }
            changes.push(`Origen: ${currentOrigin} -> ${origin}`);
          }
        }

        // Add audit log if there are changes
        if (changes.length > 0 || updateNote) {
          const newAuditEntry = {
            date: new Date().toISOString(),
            action: 'BATCH_UPDATE',
            details: `Batch Update: ${changes.join(', ')}${updateNote ? '. Note appended.' : ''}`,
          };
          
          currentMetadata.auditLog = [
            ...(currentMetadata.auditLog || []),
            newAuditEntry
          ];
          metadataChanged = true;
        }

        // Handle Note Appending
        if (updateNote && appendNote.trim()) {
           userNotes = userNotes ? `${userNotes}\n${appendNote}` : appendNote;
        }

        if (updateProductServiceDescription) {
          updates.productServiceDescription = trimmedDescription;
          changes.push('Descripción actualizada');
        }

        // Reconstruct notes with metadata if needed
        if (metadataChanged || updateNote) {
          updates.notes = `${userNotes}${METADATA_SEPARATOR}${JSON.stringify(currentMetadata)}`;
        }

        // Only save if there are actual updates
        if (Object.keys(updates).length > 0) {
          await onSave(invoice.id, updates);
        }
        processed++;
      });

      await Promise.all(promises);
      toast.success(`${processed} facturas actualizadas correctamente`);
      handleClose();
    } catch (error) {
      console.error('Error updating invoices:', error);
      toast.error('Error al actualizar facturas');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edición Masiva ({selectedInvoices.length} facturas)</DialogTitle>
          <DialogDescription>
            Seleccione los campos que desea actualizar para todas las facturas seleccionadas.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-6 py-4">
          {hasSystemInvoices && (
            <Alert variant="destructive" className="border-amber-300 bg-amber-50">
              <ShieldAlert className="size-4 !text-amber-600" />
              <AlertDescription className="text-amber-800 text-xs">
                {systemInvoiceCount} factura(s) del sistema serán excluidas de los cambios de Estado y Origen, 
                ya que están vinculadas a cierres y servicios. Solo se aplicarán cambios de notas y metadatos.
              </AlertDescription>
            </Alert>
          )}

          {/* Status Section */}
          <div className="flex items-start gap-4">
            <Checkbox 
              id="check-status" 
              checked={updateStatus} 
              onCheckedChange={(c) => setUpdateStatus(c === true)}
              className="mt-3"
            />
            <div className="grid gap-2 flex-1">
              <Label htmlFor="status" className={!updateStatus ? 'text-muted-foreground' : ''}>
                Estado
              </Label>
              <Select 
                value={status} 
                onValueChange={setStatus}
                disabled={!updateStatus}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar nuevo estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Borrador</SelectItem>
                  <SelectItem value="sent">Enviada</SelectItem>
                  <SelectItem value="paid">Pagada</SelectItem>
                  <SelectItem value="overdue">Vencida</SelectItem>
                  <SelectItem value="cancelled">Anulada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <Checkbox
              id="check-psd"
              checked={updateProductServiceDescription}
              onCheckedChange={(c) => setUpdateProductServiceDescription(c === true)}
              className="mt-3"
            />
            <div className="grid gap-2 flex-1">
              <Label htmlFor="productServiceDescription" className={!updateProductServiceDescription ? 'text-muted-foreground' : ''}>
                Descripción de Producto o Servicio
              </Label>
              <Textarea
                id="productServiceDescription"
                value={productServiceDescription}
                onChange={(e) => setProductServiceDescription(e.target.value)}
                disabled={!updateProductServiceDescription}
                className="min-h-[90px] resize-none"
                placeholder="Describe el motivo o razón que originó la creación del documento..."
              />
            </div>
          </div>

          {/* Shipping Info Section */}
          <div className="flex items-start gap-4">
            <Checkbox 
              id="check-shipping" 
              checked={updateShipping} 
              onCheckedChange={(c) => setUpdateShipping(c === true)}
              className="mt-3"
            />
            <div className="grid gap-2 flex-1">
              <Label htmlFor="shipping" className={!updateShipping ? 'text-muted-foreground' : ''}>
                Info. Envío
              </Label>
              <Input
                id="shipping"
                value={shippingInfo}
                onChange={(e) => setShippingInfo(e.target.value)}
                disabled={!updateShipping}
                placeholder="Ej: Chilexpress 123456"
              />
            </div>
          </div>

          {/* Payment Method Section */}
          <div className="flex items-start gap-4">
            <Checkbox 
              id="check-payment" 
              checked={updatePayment} 
              onCheckedChange={(c) => setUpdatePayment(c === true)}
              className="mt-3"
            />
            <div className="grid gap-2 flex-1">
              <Label htmlFor="payment" className={!updatePayment ? 'text-muted-foreground' : ''}>
                Método Pago
              </Label>
              <Input
                id="payment"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                disabled={!updatePayment}
                placeholder="Ej: Transferencia Banco Chile"
              />
            </div>
          </div>

          {/* Notes Section */}
          <div className="flex items-start gap-4">
            <Checkbox 
              id="check-note" 
              checked={updateNote} 
              onCheckedChange={(c) => setUpdateNote(c === true)}
              className="mt-3"
            />
            <div className="grid gap-2 flex-1">
              <Label htmlFor="note" className={!updateNote ? 'text-muted-foreground' : ''}>
                Agregar Nota
              </Label>
              <Textarea
                id="note"
                value={appendNote}
                onChange={(e) => setAppendNote(e.target.value)}
                disabled={!updateNote}
                placeholder="Esta nota se agregará a las existentes..."
                className="min-h-[80px]"
              />
            </div>
          </div>

          {/* Origin Section */}
          <div className="flex items-start gap-4">
            <Checkbox 
              id="check-origin" 
              checked={updateOrigin} 
              onCheckedChange={(c) => setUpdateOrigin(c === true)}
              className="mt-3"
            />
            <div className="grid gap-2 flex-1">
              <Label htmlFor="origin" className={!updateOrigin ? 'text-muted-foreground' : ''}>
                Origen
              </Label>
              <Select 
                value={origin} 
                onValueChange={setOrigin}
                disabled={!updateOrigin}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar origen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="importada">Importada (Histórica)</SelectItem>
                  <SelectItem value="sistema">Sistema</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSubmitting || (!updateStatus && !updateShipping && !updatePayment && !updateNote && !updateOrigin)}>
            {isSubmitting ? 'Guardando...' : 'Aplicar Cambios'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
