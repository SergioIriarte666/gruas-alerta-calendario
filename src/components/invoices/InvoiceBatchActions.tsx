import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { 
  CheckCircle, 
  Trash2, 
  FileSpreadsheet,
  X,
  ShieldAlert,
  Wallet
} from 'lucide-react';
import { Invoice } from '@/types';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import { computeIvaToSeparate } from '@/utils/ivaF29Utils';

interface InvoiceBatchActionsProps {
  selectedInvoices: Invoice[];
  onMarkAsPaid: (invoiceIds: string[]) => void;
  onDelete: (invoiceIds: string[]) => void;
  onExport: (invoiceIds: string[]) => void;
  onClearSelection: () => void;
}

const InvoiceBatchActions = ({
  selectedInvoices,
  onMarkAsPaid,
  onDelete,
  onExport,
  onClearSelection
}: InvoiceBatchActionsProps) => {
  const [confirmAction, setConfirmAction] = useState<'paid' | 'delete' | null>(null);
  const unpaidInvoices = useMemo(
    () => selectedInvoices.filter((inv) => inv.status !== 'paid'),
    [selectedInvoices],
  );

  const handleMarkAsPaid = () => {
    if (unpaidInvoices.length === 0) {
      toast.info('Todas las facturas seleccionadas ya están pagadas');
      return;
    }

    setConfirmAction('paid');
  };

  const handleDelete = () => {
    setConfirmAction('delete');
  };

  const handleExport = () => {
    onExport(selectedInvoices.map(inv => inv.id));
  };

  if (selectedInvoices.length === 0) return null;

  const totalAmount = selectedInvoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0);
  const protectedCount = selectedInvoices.filter(inv => !inv.folio?.startsWith('HIST-')).length;
  const statusCounts = selectedInvoices.reduce((counts, inv) => {
    counts[inv.status] = (counts[inv.status] || 0) + 1;
    return counts;
  }, {} as Record<string, number>);

  return (
    <>
    <Card className="sticky top-14 z-20 border-border/70 bg-card/95 shadow-sm backdrop-blur sm:top-16">
      <CardContent className="p-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Badge className="border-primary/20 bg-primary/10 text-primary">
                {selectedInvoices.length} facturas seleccionadas
              </Badge>
              <span className="font-medium text-foreground">
                Total: ${totalAmount.toLocaleString('es-CL')}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              {Object.entries(statusCounts).map(([status, count]) => {
                const statusLabels = {
                  draft: 'Borrador',
                  sent: 'Enviada',
                  paid: 'Pagada',
                  overdue: 'Vencida',
                  cancelled: 'Anulada'
                };
                
                const statusColors = {
                  draft: 'bg-muted text-foreground',
                  sent: 'bg-info/15 text-info',
                  paid: 'bg-success/15 text-success',
                  overdue: 'bg-danger/15 text-danger',
                  cancelled: 'bg-muted text-muted-foreground'
                };
                
                return (
                  <Badge 
                    key={status} 
                    className={`${statusColors[status as keyof typeof statusColors]} text-xs`}
                  >
                    {statusLabels[status as keyof typeof statusLabels]}: {count}
                  </Badge>
                );
              })}
            </div>
            
            {protectedCount > 0 && (
              <div className="flex items-center gap-1.5 text-warning text-xs">
                <ShieldAlert className="size-4" />
                <span>{protectedCount} factura(s) protegida(s) — requieren confirmación reforzada</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAsPaid}
              className="border-success/20 bg-success/10 text-success hover:bg-success/15 hover:border-success/30"
              disabled={selectedInvoices.every(inv => inv.status === 'paid')}
            >
              <CheckCircle className="size-4 mr-2" />
              Marcar como Pagadas
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="border-info/20 bg-info/10 text-info hover:bg-info/15 hover:border-info/30"
            >
              <FileSpreadsheet className="size-4 mr-2" />
              Exportar
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              className="border-danger/20 bg-danger/10 text-danger hover:bg-danger/15 hover:border-danger/30"
            >
              <Trash2 className="size-4 mr-2" />
              Eliminar
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
              className="text-muted-foreground hover:text-foreground hover:bg-accent"
            >
              <X className="size-4 mr-2" />
              Limpiar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
    <AlertDialog open={confirmAction !== null} onOpenChange={(open) => !open && setConfirmAction(null)}>
      <AlertDialogContent className="border-border/70 bg-popover/95">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {confirmAction === 'paid' ? 'Marcar facturas como pagadas' : 'Eliminar facturas seleccionadas'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {confirmAction === 'paid'
              ? `Se actualizarán ${unpaidInvoices.length} factura(s) al estado pagada.`
              : `Se eliminarán ${selectedInvoices.length} factura(s). Las históricas se borrarán de inmediato y las protegidas pedirán validación reforzada.`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {confirmAction === 'paid' && (() => {
          const { total: ivaTotal, items } = computeIvaToSeparate(unpaidInvoices);
          if (ivaTotal <= 0) return null;
          return (
            <div className="rounded-lg border-2 border-primary/50 bg-primary/5 p-3">
              <div className="flex items-center gap-3">
                <Wallet className="size-5 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-muted-foreground">IVA a separar para F29</p>
                  <p className="text-lg font-bold text-primary">{formatCurrency(ivaTotal)}</p>
                </div>
              </div>
              {items.length > 1 && (
                <ul className="mt-2 max-h-32 space-y-0.5 overflow-y-auto text-xs text-muted-foreground">
                  {items.filter((item) => item.iva > 0).map((item) => (
                    <li key={item.folio} className="flex justify-between gap-4">
                      <span className="truncate">{item.folio}</span>
                      <span className="whitespace-nowrap">{formatCurrency(item.iva)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })()}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setConfirmAction(null)}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className={confirmAction === 'delete' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            onClick={() => {
              if (confirmAction === 'paid') {
                onMarkAsPaid(unpaidInvoices.map((inv) => inv.id));
              } else if (confirmAction === 'delete') {
                onDelete(selectedInvoices.map((inv) => inv.id));
              }
              setConfirmAction(null);
            }}
          >
            Confirmar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
};

export default InvoiceBatchActions;
