import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Receipt, Calendar, User, ListChecks, DollarSign, FileText } from 'lucide-react';
import { cn, toTitleCase } from '@/lib/utils';
import { ClosureStatus } from '@/types';

interface ClosureSummaryPanelProps {
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  clientName: string;
  selectedCount: number;
  total: number;
  purchaseOrder: string;
  status: ClosureStatus;
}

const STATUS_LABELS: Record<ClosureStatus, { label: string; className: string }> = {
  open: { label: 'Abierto', className: 'border-warning/30 bg-warning-soft text-warning' },
  closed: { label: 'Cerrado', className: 'border-info/30 bg-info-soft text-info' },
  invoiced: { label: 'Facturado', className: 'border-success/30 bg-success-soft text-success' },
  quoted: { label: 'Cotizado', className: 'border-primary/30 bg-primary-soft text-primary' },
  purchase_order_pending: { label: 'Esperando OC', className: 'border-warning/30 bg-warning-soft text-warning' },
};

export const ClosureSummaryPanel = ({
  dateFrom,
  dateTo,
  clientName,
  selectedCount,
  total,
  purchaseOrder,
  status,
}: ClosureSummaryPanelProps) => {
  const formatCurrency = (value: number) => {
    return value.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
  };

  const formatDate = (date: Date | undefined) => {
    if (!date) return '-';
    return date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const statusConfig = STATUS_LABELS[status];

  return (
    <Card className="bg-gradient-to-b from-card to-muted/30 border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Receipt className="size-4 text-primary" />
            Resumen del Cierre
          </span>
          <Badge className={statusConfig.className}>
            {statusConfig.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Período */}
        <div className="flex items-start gap-2">
          <Calendar className="size-4 text-muted-foreground mt-0.5" />
          <div className="flex-1">
            <span className="text-xs text-muted-foreground block">Período:</span>
            <span className="text-sm font-medium">
              {formatDate(dateFrom)} - {formatDate(dateTo)}
            </span>
          </div>
        </div>

        {/* Cliente */}
        {clientName && (
          <div className="flex items-center gap-2">
            <User className="size-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Cliente:</span>
            <span className="text-sm font-medium truncate">{toTitleCase(clientName)}</span>
          </div>
        )}

        {/* Servicios */}
        <div className="flex items-center gap-2">
          <ListChecks className="size-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Servicios:</span>
          <Badge variant={selectedCount > 0 ? "default" : "secondary"} className={cn(
            selectedCount > 0 && "bg-primary text-primary-foreground"
          )}>
            {selectedCount} seleccionados
          </Badge>
        </div>

        {/* Orden de Compra */}
        {purchaseOrder && (
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">OC:</span>
            <span className="text-sm font-mono">{purchaseOrder}</span>
          </div>
        )}

        <Separator className="my-3" />

        {/* Total */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="size-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Total:</span>
          </div>
          <span className={cn(
            "text-lg font-bold",
            total > 0 ? "text-success" : "text-muted-foreground"
          )}>
            {formatCurrency(total)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};
