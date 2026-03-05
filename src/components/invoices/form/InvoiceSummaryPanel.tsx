import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Receipt, Calendar, DollarSign, FileText, Building2 } from 'lucide-react';
import { cn, toTitleCase } from '@/lib/utils';

interface InvoiceSummaryPanelProps {
  status: string;
  numeroFiscal: string;
  issueDate: string;
  dueDate: string;
  paymentDate: string;
  clientName: string;
  closureFolio: string;
  subtotal: number;
  vat: number;
  total: number;
  isEditing: boolean;
}

export const InvoiceSummaryPanel = ({
  status,
  numeroFiscal,
  issueDate,
  dueDate,
  paymentDate,
  clientName,
  closureFolio,
  subtotal,
  vat,
  total,
  isEditing,
}: InvoiceSummaryPanelProps) => {
  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-CL');
  };

  const getStatusBadge = () => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      draft: { label: 'Borrador', className: 'bg-gray-500/20 text-gray-700 dark:text-gray-300 border-gray-500/30' },
      sent: { label: 'Enviada', className: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30' },
      paid: { label: 'Pagada', className: 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30' },
      overdue: { label: 'Vencida', className: 'bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30' },
      cancelled: { label: 'Cancelada', className: 'bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/30' },
    };
    const config = statusConfig[status] || statusConfig.draft;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  return (
    <Card className="bg-gradient-to-b from-card to-muted/30 border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-violet-500" />
            Resumen de Factura
          </span>
          {getStatusBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Número Fiscal */}
        {numeroFiscal && (
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">N° Fiscal:</span>
            <span className="text-sm font-mono font-semibold text-violet-600 dark:text-violet-400">
              {numeroFiscal}
            </span>
          </div>
        )}

        {/* Cliente */}
        {clientName && (
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Cliente:</span>
            <span className="text-sm font-medium truncate">{toTitleCase(clientName)}</span>
          </div>
        )}

        {/* Cierre */}
        {closureFolio && (
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Cierre:</span>
            <Badge variant="secondary" className="text-xs bg-violet-500/10 text-violet-700 dark:text-violet-300">
              {closureFolio}
            </Badge>
          </div>
        )}

        <Separator className="my-3" />

        {/* Fechas */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Fechas:</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs ml-6">
            <div>
              <span className="text-muted-foreground">Emisión:</span>
              <span className="ml-1">{formatDate(issueDate)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Vencimiento:</span>
              <span className="ml-1">{formatDate(dueDate)}</span>
            </div>
            {paymentDate && status === 'paid' && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Pago:</span>
                <span className="ml-1 text-green-600 dark:text-green-400">{formatDate(paymentDate)}</span>
              </div>
            )}
          </div>
        </div>

        <Separator className="my-3" />

        {/* Totales */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Montos:</span>
          </div>
          
          <div className="space-y-1 ml-6 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal:</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">IVA (19%):</span>
              <span>{formatCurrency(vat)}</span>
            </div>
            <Separator className="my-1" />
            <div className="flex justify-between font-semibold">
              <span>Total:</span>
              <span className="text-violet-600 dark:text-violet-400">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        {/* Indicador de modo */}
        {isEditing && (
          <div className="mt-3 p-2 bg-amber-500/10 border border-amber-500/30 rounded-md">
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Modo edición - Los cambios actualizarán la factura existente
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
