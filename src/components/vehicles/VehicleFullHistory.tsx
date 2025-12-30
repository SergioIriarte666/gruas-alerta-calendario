import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Car, 
  FileText, 
  Receipt, 
  ClipboardList, 
  TrendingUp,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { formatCurrency } from '@/utils/statusHelpers';
import { VehicleFullHistoryData, VehicleHistoryRecord } from '@/hooks/useVehicleFullHistory';

interface VehicleFullHistoryProps {
  data: VehicleFullHistoryData | null | undefined;
  isLoading: boolean;
  error: Error | null;
}

const getStatusConfig = (status: string) => {
  const configs: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    pending: { label: 'Pendiente', variant: 'secondary' },
    in_progress: { label: 'En Progreso', variant: 'default' },
    completed: { label: 'Completado', variant: 'default' },
    invoiced: { label: 'Facturado', variant: 'default' },
    cancelled: { label: 'Cancelado', variant: 'destructive' },
    failed: { label: 'Fallido', variant: 'destructive' },
    quoted: { label: 'Cotizado', variant: 'outline' },
    purchase_order_pending: { label: 'OC Pendiente', variant: 'secondary' },
    with_purchase_order: { label: 'Con OC', variant: 'outline' },
    draft: { label: 'Borrador', variant: 'secondary' },
    sent: { label: 'Enviada', variant: 'outline' },
    paid: { label: 'Pagada', variant: 'default' },
    overdue: { label: 'Vencida', variant: 'destructive' },
    partially_paid: { label: 'Pago Parcial', variant: 'secondary' }
  };
  return configs[status] || { label: status, variant: 'secondary' as const };
};

const getTypeConfig = (type: string) => {
  const configs: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    service: { label: 'Servicio', icon: <Car className="h-4 w-4" />, color: 'text-blue-600' },
    quote: { label: 'Cotización', icon: <ClipboardList className="h-4 w-4" />, color: 'text-amber-600' },
    purchase_order: { label: 'OC', icon: <FileText className="h-4 w-4" />, color: 'text-purple-600' },
    invoice: { label: 'Factura', icon: <Receipt className="h-4 w-4" />, color: 'text-green-600' }
  };
  return configs[type] || { label: type, icon: <FileText className="h-4 w-4" />, color: 'text-muted-foreground' };
};

const formatDate = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleDateString('es-CL', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
};

export const VehicleFullHistory: React.FC<VehicleFullHistoryProps> = ({ data, isLoading, error }) => {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="flex items-center gap-3 py-6">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <p className="text-destructive">Error al cargar el historial: {error.message}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.records.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Car className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            No se encontraron registros para este vehículo.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Información del vehículo */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Car className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-mono">{data.licensePlate.toUpperCase()}</CardTitle>
              <CardDescription>
                {data.vehicleBrand && data.vehicleModel 
                  ? `${data.vehicleBrand} ${data.vehicleModel}`
                  : 'Información del vehículo'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Métricas resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Car className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.summary.totalServices}</p>
                <p className="text-xs text-muted-foreground">Servicios</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <Receipt className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.summary.totalInvoices}</p>
                <p className="text-xs text-muted-foreground">Facturas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.summary.completedServices}</p>
                <p className="text-xs text-muted-foreground">Completados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-lg font-bold">{formatCurrency(data.summary.totalValue)}</p>
                <p className="text-xs text-muted-foreground">Valor Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Información adicional */}
      <div className="flex flex-wrap gap-2">
        {data.summary.totalQuotes > 0 && (
          <Badge variant="outline" className="gap-1">
            <ClipboardList className="h-3 w-3" />
            {data.summary.totalQuotes} Cotizaciones
          </Badge>
        )}
        {data.summary.totalPurchaseOrders > 0 && (
          <Badge variant="outline" className="gap-1">
            <FileText className="h-3 w-3" />
            {data.summary.totalPurchaseOrders} Órdenes de Compra
          </Badge>
        )}
        {data.summary.cancelledServices > 0 && (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            {data.summary.cancelledServices} Cancelados
          </Badge>
        )}
      </div>

      {/* Tabla de historial */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial Detallado</CardTitle>
          <CardDescription>
            Cronología de todos los servicios, cotizaciones y facturas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Fecha</TableHead>
                  <TableHead className="w-[100px]">Tipo</TableHead>
                  <TableHead>Folio</TableHead>
                  <TableHead>Servicio</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Referencia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.records.map((record: VehicleHistoryRecord) => {
                  const typeConfig = getTypeConfig(record.type);
                  const statusConfig = getStatusConfig(record.status);
                  
                  return (
                    <TableRow key={`${record.type}-${record.id}`}>
                      <TableCell className="font-medium text-sm">
                        {formatDate(record.date)}
                      </TableCell>
                      <TableCell>
                        <div className={`flex items-center gap-1.5 ${typeConfig.color}`}>
                          {typeConfig.icon}
                          <span className="text-xs font-medium">{typeConfig.label}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{record.folio}</TableCell>
                      <TableCell className="text-sm max-w-[150px] truncate">
                        {record.serviceTypeName || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusConfig.variant} className="text-xs">
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm max-w-[120px] truncate">
                        {record.clientName}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(record.value)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {record.quoteNumber && `COT: ${record.quoteNumber}`}
                        {record.purchaseOrder && `OC: ${record.purchaseOrder}`}
                        {record.invoiceNumeroFiscal && `NF: ${record.invoiceNumeroFiscal}`}
                        {!record.quoteNumber && !record.purchaseOrder && !record.invoiceNumeroFiscal && '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
