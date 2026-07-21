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
          <AlertCircle className="size-5 text-destructive" />
          <p className="text-destructive">Error al cargar el historial: {error.message}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.services.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Car className="size-12 text-muted-foreground mb-4" />
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
              <Car className="size-5 text-primary" />
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
              <div className="rounded-lg bg-info-soft p-2">
                <Car className="size-4 text-info" />
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
              <div className="rounded-lg bg-success-soft p-2">
                <Receipt className="size-4 text-success" />
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
              <div className="rounded-lg bg-success-soft p-2">
                <CheckCircle2 className="size-4 text-success" />
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
                <TrendingUp className="size-4 text-primary" />
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
            <ClipboardList className="size-3" />
            {data.summary.totalQuotes} Cotizaciones
          </Badge>
        )}
        {data.summary.totalPurchaseOrders > 0 && (
          <Badge variant="outline" className="gap-1">
            <FileText className="size-3" />
            {data.summary.totalPurchaseOrders} Órdenes de Compra
          </Badge>
        )}
        {data.summary.cancelledServices > 0 && (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="size-3" />
            {data.summary.cancelledServices} Cancelados
          </Badge>
        )}
      </div>

      {/* Tabla de historial - Servicios agrupados con sus facturas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial de Servicios</CardTitle>
          <CardDescription>
            Servicios ordenados cronológicamente con sus facturas asociadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Fecha</TableHead>
                  <TableHead>Folio</TableHead>
                  <TableHead>N° Fiscal</TableHead>
                  <TableHead>Tipo Servicio</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>COT / OC</TableHead>
                  <TableHead>Factura</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.services.map((service: VehicleHistoryRecord) => {
                  const statusConfig = getStatusConfig(service.status);
                  
                  return (
                    <TableRow key={service.id}>
                      <TableCell className="font-medium text-sm">
                        {formatDate(service.date)}
                      </TableCell>
                      <TableCell className="font-mono text-sm font-medium">
                        {service.folio}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {service.relatedInvoice?.numeroFiscal || '-'}
                      </TableCell>
                      <TableCell className="max-w-36 truncate text-sm">
                        {service.serviceTypeName || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusConfig.variant} className="text-xs">
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-32 truncate text-sm">
                        {service.clientName}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(service.value)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <div className="space-y-0.5">
                          {service.quoteNumber && (
                            <div className="flex items-center gap-1">
                              <ClipboardList className="size-3" />
                              {service.quoteNumber}
                            </div>
                          )}
                          {service.purchaseOrder && (
                            <div className="flex items-center gap-1">
                              <FileText className="size-3" />
                              {service.purchaseOrder}
                            </div>
                          )}
                          {!service.quoteNumber && !service.purchaseOrder && '-'}
                        </div>
                      </TableCell>
                      <TableCell>
                        {service.relatedInvoice ? (
                          <div className="flex items-center gap-2">
                            <Receipt className="size-4 text-success" />
                            <div className="text-xs font-medium">
                              {service.relatedInvoice.numeroFiscal || 'Pendiente'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sin factura</span>
                        )}
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
