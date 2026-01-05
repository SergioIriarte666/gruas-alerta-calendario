import React from 'react';
import { useSupplierInvoices, SupplierInvoice } from '@/hooks/useSupplierInvoices';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText, AlertTriangle, CheckCircle } from 'lucide-react';
import { format, parseISO, isBefore } from 'date-fns';
import { es } from 'date-fns/locale';

interface SupplierInvoiceSelectorProps {
  supplierId: string;
  selectedInvoices: string[];
  onSelectionChange: (invoiceIds: string[], totalAmount: number) => void;
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

const getInvoiceStatusBadge = (invoice: SupplierInvoice) => {
  const isOverdue = isBefore(parseISO(invoice.due_date), new Date());
  const isPaid = invoice.status === 'paid' || (invoice.balance !== null && invoice.balance <= 0);
  const isPartial = (invoice.paid_amount || 0) > 0 && !isPaid;

  if (isPaid) {
    return (
      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
        <CheckCircle className="h-3 w-3 mr-1" />
        Pagada
      </Badge>
    );
  }

  if (isOverdue) {
    return (
      <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
        <AlertTriangle className="h-3 w-3 mr-1" />
        Vencida
      </Badge>
    );
  }

  if (isPartial) {
    return (
      <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
        Pago Parcial
      </Badge>
    );
  }

  return (
    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
      Pendiente
    </Badge>
  );
};

export const SupplierInvoiceSelector: React.FC<SupplierInvoiceSelectorProps> = ({
  supplierId,
  selectedInvoices,
  onSelectionChange
}) => {
  const { pendingInvoices, isPendingLoading } = useSupplierInvoices(supplierId);

  const handleInvoiceToggle = (invoiceId: string, balance: number) => {
    let newSelection: string[];
    
    if (selectedInvoices.includes(invoiceId)) {
      newSelection = selectedInvoices.filter(id => id !== invoiceId);
    } else {
      newSelection = [...selectedInvoices, invoiceId];
    }

    // Calculate total amount from selected invoices
    const totalAmount = pendingInvoices
      .filter(inv => newSelection.includes(inv.id))
      .reduce((sum, inv) => sum + (inv.balance || inv.amount || 0), 0);

    onSelectionChange(newSelection, totalAmount);
  };

  const handleSelectAll = () => {
    if (selectedInvoices.length === pendingInvoices.length) {
      onSelectionChange([], 0);
    } else {
      const allIds = pendingInvoices.map(inv => inv.id);
      const totalAmount = pendingInvoices.reduce((sum, inv) => sum + (inv.balance || inv.amount || 0), 0);
      onSelectionChange(allIds, totalAmount);
    }
  };

  if (isPendingLoading) {
    return (
      <div className="flex items-center justify-center p-4 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Cargando facturas...
      </div>
    );
  }

  if (pendingInvoices.length === 0) {
    return (
      <div className="text-center p-4 text-muted-foreground bg-muted/30 rounded-lg border border-dashed">
        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No hay facturas pendientes para este proveedor</p>
      </div>
    );
  }

  const selectedTotal = pendingInvoices
    .filter(inv => selectedInvoices.includes(inv.id))
    .reduce((sum, inv) => sum + (inv.balance || inv.amount || 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={selectedInvoices.length === pendingInvoices.length && pendingInvoices.length > 0}
            onCheckedChange={handleSelectAll}
          />
          <span className="text-sm text-muted-foreground">
            Seleccionar todas ({pendingInvoices.length})
          </span>
        </div>
        {selectedInvoices.length > 0 && (
          <Badge variant="outline" className="bg-violet-500/10 text-violet-400 border-violet-500/30">
            Total: {formatCurrency(selectedTotal)}
          </Badge>
        )}
      </div>

      <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
        {pendingInvoices.map((invoice) => {
          const isSelected = selectedInvoices.includes(invoice.id);
          const balance = invoice.balance || invoice.amount || 0;

          return (
            <div
              key={invoice.id}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                isSelected 
                  ? 'bg-violet-500/10 border-violet-500/30' 
                  : 'bg-muted/30 border-border hover:bg-muted/50'
              }`}
              onClick={() => handleInvoiceToggle(invoice.id, balance)}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => handleInvoiceToggle(invoice.id, balance)}
                onClick={(e) => e.stopPropagation()}
              />
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm truncate">
                    {invoice.invoice_number}
                  </span>
                  {getInvoiceStatusBadge(invoice)}
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>
                    Emisión: {format(parseISO(invoice.issue_date), 'dd/MM/yyyy', { locale: es })}
                  </span>
                  <span>
                    Vence: {format(parseISO(invoice.due_date), 'dd/MM/yyyy', { locale: es })}
                  </span>
                </div>
              </div>

              <div className="text-right">
                <div className="text-sm font-semibold text-foreground">
                  {formatCurrency(balance)}
                </div>
                {(invoice.paid_amount || 0) > 0 && (
                  <div className="text-xs text-muted-foreground">
                    de {formatCurrency(invoice.amount)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
