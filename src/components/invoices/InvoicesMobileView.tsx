import { Invoice } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, Edit, CheckCircle, Ban, FileText, Calendar, User, DollarSign } from 'lucide-react';
import { format, isValid, parseISO, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { useState } from 'react';
import { InvoiceDetailsModal } from './InvoiceDetailsModal';
import { InvoiceCancellationModal } from './InvoiceCancellationModal';

interface InvoicesMobileViewProps {
  invoices: Invoice[];
  onEdit: (invoice: Invoice) => void;
  onDelete: (id: string) => void;
  onMarkAsPaid: (id: string) => void;
  getInvoiceWithDetails: (invoice: Invoice) => any;
  onRefresh?: () => void;
}

const formatSafeDate = (dateValue: any): string => {
  if (!dateValue) return 'Sin fecha';
  try {
    const date = typeof dateValue === 'string' ? parseISO(dateValue) : new Date(dateValue);
    if (!isValid(date)) return 'Fecha inválida';
    return format(date, 'dd/MM/yyyy', { locale: es });
  } catch {
    return 'Error';
  }
};

const formatSafeAmount = (amount: any): string => {
  const numAmount = Number(amount);
  if (isNaN(numAmount)) return '$0';
  return `$${numAmount.toLocaleString('es-CL')}`;
};

const getStatusBadge = (status: string) => {
  const statusConfig: Record<string, { label: string; className: string }> = {
    draft: { label: 'Borrador', className: 'bg-muted text-foreground' },
    sent: { label: 'Enviada', className: 'bg-secondary text-secondary-foreground' },
    paid: { label: 'Pagada', className: 'bg-primary text-primary-foreground' },
    overdue: { label: 'Vencida', className: 'bg-destructive text-destructive-foreground' },
    cancelled: { label: 'Anulada', className: 'bg-muted text-muted-foreground' },
  };
  const config = statusConfig[status] || statusConfig.draft;
  return <Badge className={config.className}>{config.label}</Badge>;
};

const getDaysUntilDueBadge = (dueDate: any, status: string) => {
  if (status === 'paid') return <Badge className="bg-green-500 text-white text-xs">✓ Pagada</Badge>;
  if (!dueDate) return null;
  try {
    const due = typeof dueDate === 'string' ? parseISO(dueDate) : new Date(dueDate);
    if (!isValid(due)) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    const days = differenceInDays(due, today);
    if (days > 7) return <Badge className="bg-green-500 text-white text-xs">+{days}d</Badge>;
    if (days >= 1) return <Badge className="bg-yellow-500 text-white text-xs">+{days}d</Badge>;
    if (days === 0) return <Badge className="bg-orange-500 text-white text-xs">Hoy</Badge>;
    return <Badge className="bg-red-500 text-white text-xs">{days}d</Badge>;
  } catch {
    return null;
  }
};

export const InvoicesMobileView = ({
  invoices,
  onEdit,
  onDelete,
  onMarkAsPaid,
  getInvoiceWithDetails,
  onRefresh,
}: InvoicesMobileViewProps) => {
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [cancellingInvoice, setCancellingInvoice] = useState<Invoice | null>(null);

  const getClientName = (invoice: Invoice): string => {
    const details = getInvoiceWithDetails(invoice);
    return details?.client?.name || 'Cliente no encontrado';
  };

  if (invoices.length === 0) {
    return (
      <Card className="bg-card border">
        <CardContent className="p-6 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <h3 className="text-base font-medium text-foreground mb-1">No hay facturas</h3>
          <p className="text-sm text-muted-foreground">No se encontraron facturas con los filtros aplicados</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground px-1">
        <FileText className="w-4 h-4 inline mr-1" />
        {invoices.length} factura{invoices.length !== 1 ? 's' : ''}
      </p>

      {invoices.map((invoice) => {
        if (!invoice?.id) return null;
        const invoiceWithDetails = getInvoiceWithDetails(invoice);
        const clientName = invoiceWithDetails?.client?.name || 'Cliente no encontrado';

        return (
          <Card key={invoice.id} className="border">
            <CardContent className="p-3">
              {/* Header: Folio + Status */}
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className="text-foreground font-semibold text-sm">{invoice.folio}</span>
                  {invoice.numeroFiscal && (
                    <span className="text-violet-600 text-xs ml-2">N°{invoice.numeroFiscal}</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {getDaysUntilDueBadge(invoice.dueDate, invoice.status)}
                  {getStatusBadge(invoice.status)}
                </div>
              </div>

              {/* Details */}
              <div className="space-y-1.5 text-sm mb-3">
                <div className="flex items-center text-foreground">
                  <User className="w-3.5 h-3.5 mr-2 text-muted-foreground flex-shrink-0" />
                  <span className="truncate">{clientName}</span>
                </div>
                <div className="flex items-center text-foreground">
                  <Calendar className="w-3.5 h-3.5 mr-2 text-muted-foreground flex-shrink-0" />
                  <span>{formatSafeDate(invoice.issueDate)}</span>
                  {invoice.dueDate && (
                    <span className="text-muted-foreground ml-1">→ {formatSafeDate(invoice.dueDate)}</span>
                  )}
                </div>
                <div className="flex items-center text-violet-600 font-bold">
                  <DollarSign className="w-3.5 h-3.5 mr-2 flex-shrink-0" />
                  {formatSafeAmount(invoice.total)}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => setViewingInvoice(invoice)}
                >
                  <Eye className="w-3.5 h-3.5 mr-1" />
                  Ver
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => onEdit(invoice)}
                >
                  <Edit className="w-3.5 h-3.5 mr-1" />
                  Editar
                </Button>
                {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs px-2"
                    onClick={() => onMarkAsPaid(invoice.id)}
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                  </Button>
                )}
                {invoice.status !== 'cancelled' && invoice.status !== 'paid' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs px-2 text-destructive border-destructive/40 hover:bg-destructive/10"
                    onClick={() => setCancellingInvoice(invoice)}
                  >
                    <Ban className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      <InvoiceDetailsModal
        invoice={viewingInvoice}
        isOpen={!!viewingInvoice}
        onClose={() => setViewingInvoice(null)}
      />

      <InvoiceCancellationModal
        invoice={cancellingInvoice}
        isOpen={!!cancellingInvoice}
        onClose={() => setCancellingInvoice(null)}
        onSuccess={() => onRefresh?.()}
        getClientName={getClientName}
      />
    </div>
  );
};
