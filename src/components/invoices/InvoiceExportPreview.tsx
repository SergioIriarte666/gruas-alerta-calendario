import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileText, DollarSign, Calendar, User, CheckCircle2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useClients } from '@/hooks/useClients';

interface InvoiceExportPreviewProps {
  invoiceCount: number;
  totalAmount: number;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  clientId: string;
  status: string;
}

const INVOICE_STATUS_LABELS: Record<string, string> = {
  all: 'Todas',
  draft: 'Borrador',
  sent: 'Enviada',
  paid: 'Pagada',
  overdue: 'Vencida',
  cancelled: 'Anulada'
};

const InvoiceExportPreview = ({ 
  invoiceCount, 
  totalAmount, 
  dateFrom, 
  dateTo, 
  clientId,
  status 
}: InvoiceExportPreviewProps) => {
  const { clients } = useClients();
  const selectedClient = clients.find(c => c.id === clientId);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP'
    }).format(amount);
  };

  const hasValidDateRange = dateFrom && dateTo;
  const hasInvoices = invoiceCount > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">📊 VISTA PREVIA</h3>
      </div>

      {!hasValidDateRange ? (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Selecciona un rango de fechas para ver la vista previa
          </AlertDescription>
        </Alert>
      ) : !hasInvoices ? (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            No se encontraron facturas con los filtros seleccionados
          </AlertDescription>
        </Alert>
      ) : (
        <Card className="p-4 bg-muted/50">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <span className="font-semibold text-lg">
                Se exportarán {invoiceCount} {invoiceCount === 1 ? 'factura' : 'facturas'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t">
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Total:</span>
                <span className="font-semibold">{formatCurrency(totalAmount)}</span>
              </div>

              {dateFrom && dateTo && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Período:</span>
                  <span className="font-medium">
                    {format(dateFrom, 'dd/MM/yyyy', { locale: es })} - {format(dateTo, 'dd/MM/yyyy', { locale: es })}
                  </span>
                </div>
              )}

              {selectedClient && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Cliente:</span>
                  <span className="font-medium">{selectedClient.name}</span>
                </div>
              )}

              {status && status !== 'all' && (
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Estado:</span>
                  <span className="font-medium">{INVOICE_STATUS_LABELS[status] || status}</span>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default InvoiceExportPreview;
