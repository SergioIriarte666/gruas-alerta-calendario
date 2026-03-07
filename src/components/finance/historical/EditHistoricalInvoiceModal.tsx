import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import { Invoice } from '@/types';
import { format } from 'date-fns';

interface EditHistoricalInvoiceModalProps {
  invoice: Invoice | null;
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

type OriginType = 'importada' | 'sistema';

const getOriginFromFolio = (folio: string): OriginType => {
  return folio.startsWith('HIST-') ? 'importada' : 'sistema';
};

const stripHistPrefix = (folio: string): string => {
  return folio.replace(/^HIST-(F|NC|ND)-/, '');
};

const addHistPrefix = (folio: string): string => {
  if (folio.startsWith('HIST-')) return folio;
  return `HIST-F-${folio}`;
};

export const EditHistoricalInvoiceModal = ({
  invoice,
  isOpen,
  onClose,
  onSave,
}: EditHistoricalInvoiceModalProps) => {
  const [status, setStatus] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [shippingInfo, setShippingInfo] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [origin, setOrigin] = useState<OriginType>('sistema');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [metadata, setMetadata] = useState<InvoiceMetadata>({});

  useEffect(() => {
    if (invoice && isOpen) {
      setStatus(invoice.status);
      setOrigin(getOriginFromFolio(invoice.folio));

      const fullNotes = invoice.notes || '';
      if (fullNotes.includes(METADATA_SEPARATOR)) {
        const [userNotes, metadataJson] = fullNotes.split(METADATA_SEPARATOR);
        setNotes(userNotes);
        try {
          const parsed = JSON.parse(metadataJson);
          setMetadata(parsed);
          setShippingInfo(parsed.shippingInfo || '');
          setPaymentMethod(parsed.paymentMethod || '');
        } catch (e) {
          console.error('Error parsing metadata:', e);
          setMetadata({});
        }
      } else {
        setNotes(fullNotes);
        setMetadata({});
        setShippingInfo('');
        setPaymentMethod('');
      }
    }
  }, [invoice, isOpen]);

  const handleSave = async () => {
    if (!invoice) return;

    setIsSubmitting(true);
    try {
      const originalOrigin = getOriginFromFolio(invoice.folio);
      const originChanged = origin !== originalOrigin;

      const auditDetails: string[] = [];
      if (invoice.status !== status) {
        auditDetails.push(`Estado: ${invoice.status} -> ${status}`);
      }
      if (originChanged) {
        auditDetails.push(`Origen: ${originalOrigin} -> ${origin}`);
      }

      const newAuditEntry = {
        date: new Date().toISOString(),
        action: 'UPDATE',
        details: `Editado vía Historical Editor. ${auditDetails.join('. ') || 'Sin cambios de estado/origen'}`,
      };

      const newMetadata: InvoiceMetadata = {
        ...metadata,
        shippingInfo,
        paymentMethod,
        auditLog: [...(metadata.auditLog || []), newAuditEntry],
      };

      const newNotes = `${notes}${METADATA_SEPARATOR}${JSON.stringify(newMetadata)}`;

      let newFolio = invoice.folio;
      if (originChanged) {
        if (origin === 'sistema') {
          newFolio = stripHistPrefix(invoice.folio);
        } else {
          newFolio = addHistPrefix(invoice.folio);
        }
      }

      const updates: Partial<Invoice> = {
        status: status as any,
        notes: newNotes,
      };

      if (originChanged) {
        updates.folio = newFolio;
      }

      await onSave(invoice.id, updates);
      onClose();
    } catch (error) {
      console.error('Error saving invoice:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] w-[95vw]">
        <DialogHeader>
          <DialogTitle>Editar Factura Histórica {invoice?.folio}</DialogTitle>
          <DialogDescription>
            Modifique los detalles de la factura. Los cambios quedarán registrados en el historial de auditoría.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="status">Estado</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar estado" />
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

            <div className="space-y-1.5">
              <Label htmlFor="origin">Origen</Label>
              <Select value={origin} onValueChange={(v) => setOrigin(v as OriginType)}>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="shipping">Info. Envío</Label>
              <Input
                id="shipping"
                value={shippingInfo}
                onChange={(e) => setShippingInfo(e.target.value)}
                placeholder="Ej: Chilexpress 123456"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="payment">Método Pago</Label>
              <Input
                id="payment"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                placeholder="Ej: Transferencia Banco Chile"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[100px]"
              placeholder="Notas internas..."
            />
          </div>

          {metadata.auditLog && metadata.auditLog.length > 0 && (
            <div className="space-y-1.5">
              <Label>Historial de Cambios</Label>
              <div className="bg-muted p-2 rounded-md text-xs max-h-32 overflow-y-auto space-y-1">
                {metadata.auditLog.slice().reverse().map((log, i) => (
                  <div key={i} className="border-b border-border/50 pb-1 last:border-0">
                    <span className="font-mono text-muted-foreground">
                      {format(new Date(log.date), 'dd/MM HH:mm')}
                    </span>
                    : {log.details}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
