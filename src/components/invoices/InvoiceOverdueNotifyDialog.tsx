import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Mail, Loader2 } from 'lucide-react';
import { differenceInDays, isValid, parseISO } from 'date-fns';
import { businessClock } from '@/utils/businessClock';

interface InvoiceOverdueNotifyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isSending: boolean;
  invoice?: {
    id: string;
    folio: string;
    dueDate: string;
    total: number;
    client?: {
      name?: string;
      email?: string;
    };
  } | null;
}

const formatDate = (dateValue: string | undefined): string => {
  if (!dateValue) return 'Sin fecha';
  try {
    const date = parseISO(dateValue);
    if (!isValid(date)) return 'Fecha invalida';
    return date.toLocaleDateString('es-CL');
  } catch {
    return 'Error';
  }
};

const getDaysOverdue = (dueDate: string | undefined): number => {
  if (!dueDate) return 0;
  try {
    const due = parseISO(dueDate);
    if (!isValid(due)) return 0;
    const today = businessClock.todayDate();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    return differenceInDays(today, due);
  } catch {
    return 0;
  }
};

const formatAmount = (amount: number): string => {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
  }).format(amount);
};

export const InvoiceOverdueNotifyDialog = ({
  open,
  onOpenChange,
  onConfirm,
  isSending,
  invoice,
}: InvoiceOverdueNotifyDialogProps) => {
  if (!invoice) return null;

  const clientName = invoice.client?.name || 'Cliente';
  const clientEmail = invoice.client?.email || 'Sin email registrado';
  const daysOverdue = getDaysOverdue(invoice.dueDate);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="border-border/70 bg-popover/95">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Mail className="size-5 text-danger" />
            Notificar vencimiento al cliente
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              Se enviara un email a <strong>{clientEmail}</strong> recordando
              que la factura <strong>{invoice.folio}</strong> esta vencida.
            </p>
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cliente:</span>
                <span className="text-foreground font-medium">{clientName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Factura:</span>
                <span className="text-foreground font-medium">{invoice.folio}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Monto:</span>
                <span className="text-foreground font-medium">{formatAmount(invoice.total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vencimiento:</span>
                <span className="text-foreground font-medium">{formatDate(invoice.dueDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Dias vencida:</span>
                <span className="text-danger font-semibold">{daysOverdue} dia(s)</span>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isSending}
            className="bg-danger hover:bg-danger/90"
          >
            {isSending ? (
              <>
                <Loader2 className="size-4 mr-1 animate-spin" />
                Enviando...
              </>
            ) : (
              'Enviar notificacion'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
