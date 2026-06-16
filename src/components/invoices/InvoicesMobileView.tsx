import { Invoice } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, Edit, CheckCircle, Ban, FileText, Calendar, User, DollarSign } from 'lucide-react';
import { isValid, parseISO, differenceInDays } from 'date-fns';
import { formatForDisplay } from '@/utils/timezoneUtils';
import { businessClock } from '@/utils/businessClock';
import { useState, useEffect } from 'react';
import { InvoiceDetailsModal } from './InvoiceDetailsModal';
import { InvoiceCancellationModal } from './InvoiceCancellationModal';
import { toTitleCase } from '@/lib/utils';

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
    return formatForDisplay(date);
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
    draft: { label: 'Borrador', className: 'border-border/70 bg-muted/40 text-foreground' },
    sent: { label: 'Enviada', className: 'border-info/30 bg-info/10 text-info' },
    paid: { label: 'Pagada', className: 'border-success/30 bg-success/10 text-success' },
    overdue: { label: 'Vencida', className: 'border-danger/30 bg-danger/10 text-danger' },
    cancelled: { label: 'Anulada', className: 'border-warning/30 bg-warning/10 text-warning' },
  };
  const config = statusConfig[status] || statusConfig.draft;
  return <Badge className={config.className}>{config.label}</Badge>;
};

const getDaysUntilDueBadge = (dueDate: any, status: string) => {
  if (status === 'paid') return <Badge className="border-success/30 bg-success/10 text-success text-xs">✓ Pagada</Badge>;
  if (status === 'cancelled') return <Badge className="border-warning/30 bg-warning/10 text-warning text-xs">Anulada</Badge>;
  if (!dueDate) return null;
  try {
    const due = typeof dueDate === 'string' ? parseISO(dueDate) : new Date(dueDate);
    if (!isValid(due)) return null;
    const today = businessClock.todayDate();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    const days = differenceInDays(due, today);
    if (days > 7) return <Badge className="border-success/30 bg-success/10 text-success text-xs">+{days}d</Badge>;
    if (days >= 1) return <Badge className="border-warning/30 bg-warning/10 text-warning text-xs">+{days}d</Badge>;
    if (days === 0) return <Badge className="border-warning/30 bg-warning/10 text-warning text-xs">Hoy</Badge>;
    return <Badge className="border-danger/30 bg-danger/10 text-danger text-xs">{days}d</Badge>;
  } catch {
    return null;
  }
};

export const InvoicesMobileView = ({
  invoices,
  onEdit,
  onDelete: _onDelete,
  onMarkAsPaid,
  getInvoiceWithDetails,
  onRefresh,
}: InvoicesMobileViewProps) => {
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [cancellingInvoice, setCancellingInvoice] = useState<Invoice | null>(null);

  // Keep viewingInvoice in sync with fresh data from parent
  useEffect(() => {
    if (viewingInvoice) {
      const fresh = invoices.find(inv => inv.id === viewingInvoice.id);
      if (fresh) {
        const detailed = getInvoiceWithDetails(fresh);
        if (detailed.status !== viewingInvoice.status || 
            detailed.paidAmount !== viewingInvoice.paidAmount ||
            detailed.remainingAmount !== viewingInvoice.remainingAmount) {
          setViewingInvoice(detailed);
        }
      }
    }
  }, [invoices, viewingInvoice, getInvoiceWithDetails]);

  const getClientName = (invoice: Invoice): string => {
    const details = getInvoiceWithDetails(invoice);
    return details?.client?.name ? toTitleCase(details.client.name) : 'Cliente no encontrado';
  };

  if (invoices.length === 0) {
    return (
      <Card className="bg-card border">
        <CardContent className="p-6 text-center">
          <FileText className="mx-auto size-10 text-muted-foreground mb-3" />
          <h3 className="text-base font-medium text-foreground mb-1">No hay facturas</h3>
          <p className="text-sm text-muted-foreground">No se encontraron facturas con los filtros aplicados</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground px-1">
        <FileText className="size-4 inline mr-1" />
        {invoices.length} factura{invoices.length !== 1 ? 's' : ''}
      </p>

      {invoices.map((invoice) => {
        if (!invoice?.id) return null;
        const invoiceWithDetails = getInvoiceWithDetails(invoice);
        const clientName = invoiceWithDetails?.client?.name ? toTitleCase(invoiceWithDetails.client.name) : 'Cliente no encontrado';

        return (
          <Card key={invoice.id} className="border-border/70 bg-card shadow-sm">
            <CardContent className="p-3">
              {/* Header: Folio + Status */}
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className="text-foreground font-semibold text-sm">{invoice.folio}</span>
                  {invoice.numeroFiscal && (
                    <span className="ml-2 text-xs text-primary">N°{invoice.numeroFiscal}</span>
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
                  <User className="size-3.5 mr-2 text-muted-foreground flex-shrink-0" />
                  <span className="truncate">{clientName}</span>
                </div>
                <div className="flex items-center text-foreground">
                  <Calendar className="size-3.5 mr-2 text-muted-foreground flex-shrink-0" />
                  <span>{formatSafeDate(invoice.issueDate)}</span>
                  {invoice.dueDate && (
                    <span className="text-muted-foreground ml-1">→ {formatSafeDate(invoice.dueDate)}</span>
                  )}
                </div>
                <div className="flex items-center font-bold text-primary">
                  <DollarSign className="size-3.5 mr-2 flex-shrink-0" />
                  {formatSafeAmount(invoice.total)}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => setViewingInvoice(getInvoiceWithDetails(invoice))}
                >
                  <Eye className="size-3.5 mr-1" />
                  Ver
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => onEdit(invoice)}
                >
                  <Edit className="size-3.5 mr-1" />
                  Editar
                </Button>
                {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs px-2"
                    onClick={() => onMarkAsPaid(invoice.id)}
                  >
                    <CheckCircle className="size-3.5" />
                  </Button>
                )}
                {invoice.status !== 'cancelled' && invoice.status !== 'paid' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs px-2 text-destructive border-destructive/40 hover:bg-destructive/10"
                    onClick={() => setCancellingInvoice(invoice)}
                  >
                    <Ban className="size-3.5" />
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
