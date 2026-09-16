import { businessClock } from '@/utils/businessClock';

import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle, FileText } from 'lucide-react';
import { PendingPaymentWithSupplier } from '@/hooks/usePendingPayments';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface PendingPaymentSelectorProps {
  payments: PendingPaymentWithSupplier[];
  isLoading: boolean;
  selectedIds: string[];
  onSelectionChange: (ids: string[], totalAmount: number) => void;
}

export const PendingPaymentSelector: React.FC<PendingPaymentSelectorProps> = ({
  payments,
  isLoading,
  selectedIds,
  onSelectionChange
}) => {
  const handleToggle = (paymentId: string, _amount: number) => {
    let newSelection: string[];
    if (selectedIds.includes(paymentId)) {
      newSelection = selectedIds.filter(id => id !== paymentId);
    } else {
      newSelection = [...selectedIds, paymentId];
    }
    
    const total = payments
      .filter(p => newSelection.includes(p.id))
      .reduce((sum, p) => sum + p.amount, 0);
    
    onSelectionChange(newSelection, total);
  };

  const handleSelectAll = () => {
    if (selectedIds.length === payments.length) {
      onSelectionChange([], 0);
    } else {
      const allIds = payments.map(p => p.id);
      const total = payments.reduce((sum, p) => sum + p.amount, 0);
      onSelectionChange(allIds, total);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" />
        Cargando facturas pendientes...
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <AlertCircle className="size-8 mb-2 text-muted-foreground/50" />
        <p>No hay facturas pendientes de pago</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Select all header */}
      <div className="flex items-center justify-between pb-2 border-b border-border/70">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={selectedIds.length === payments.length && payments.length > 0}
            onCheckedChange={handleSelectAll}
          />
          <span className="text-sm font-medium">
            Seleccionar todas ({payments.length})
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {selectedIds.length} seleccionadas
        </span>
      </div>

      {/* Payment list */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {payments.map((payment) => (
          <div
            key={payment.id}
            className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
              selectedIds.includes(payment.id)
                ? 'bg-primary/10 border-primary/30'
                : 'bg-muted/30 hover:bg-muted/50'
            }`}
            onClick={() => handleToggle(payment.id, payment.amount)}
          >
            <Checkbox
              checked={selectedIds.includes(payment.id)}
              onCheckedChange={() => handleToggle(payment.id, payment.amount)}
              onClick={(e) => e.stopPropagation()}
            />
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="size-4 text-muted-foreground" />
                <span className="font-medium text-sm truncate">
                  {payment.reference_number || payment.description || 'Sin referencia'}
                </span>
              </div>
              
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{payment.supplier_name}</span>
                <span>•</span>
                <span>
                  Vence: {businessClock.format(payment.due_date, 'dd/MM/yyyy', { locale: es })}
                </span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1">
              <span className="font-semibold text-sm">
                ${payment.amount.toLocaleString('es-CL')}
              </span>
              <Badge
                variant="outline"
                className={
                  payment.status === 'overdue'
                    ? 'bg-destructive/10 text-destructive border-destructive/30 text-xs'
                    : 'bg-warning/10 text-warning border-warning/30 text-xs'
                }
              >
                {payment.status === 'overdue' ? 'Vencido' : 'Pendiente'}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
