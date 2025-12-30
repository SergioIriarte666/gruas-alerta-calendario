import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Receipt, ShoppingCart, Download, Car, Calendar, AlertCircle } from 'lucide-react';
import { VehicleFullHistoryEntry, VehicleFullHistorySummary } from '@/hooks/useVehicleFullHistory';
import { VehicleFullHistoryMetrics } from './VehicleFullHistoryMetrics';
import { formatForDisplay } from '@/utils/timezoneUtils';
import { formatCurrency } from '@/utils/statusHelpers';
import { cn } from '@/lib/utils';

interface VehicleFullHistoryProps {
  history: VehicleFullHistoryEntry[];
  summary: VehicleFullHistorySummary | null;
  isLoading: boolean;
  error: Error | null;
  showSensitiveData: boolean;
  onGeneratePDF: () => void;
  isGeneratingPDF: boolean;
}

const getStatusBadge = (status: string) => {
  const statusConfig: Record<string, { label: string; className: string }> = {
    pending: { label: 'Pendiente', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    in_progress: { label: 'En Proceso', className: 'bg-blue-100 text-blue-800 border-blue-200' },
    completed: { label: 'Completado', className: 'bg-green-100 text-green-800 border-green-200' },
    cancelled: { label: 'Cancelado', className: 'bg-red-100 text-red-800 border-red-200' },
    invoiced: { label: 'Facturado', className: 'bg-purple-100 text-purple-800 border-purple-200' },
    liquidated: { label: 'Liquidado', className: 'bg-teal-100 text-teal-800 border-teal-200' },
  };

  const config = statusConfig[status] || { label: status, className: 'bg-gray-100 text-gray-800 border-gray-200' };
  return <Badge variant="outline" className={config.className}>{config.label}</Badge>;
};

const getInvoiceStatusBadge = (status: string) => {
  const statusConfig: Record<string, { label: string; className: string }> = {
    draft: { label: 'Borrador', className: 'bg-gray-100 text-gray-700' },
    sent: { label: 'Enviada', className: 'bg-blue-100 text-blue-700' },
    paid: { label: 'Pagada', className: 'bg-green-100 text-green-700' },
    overdue: { label: 'Vencida', className: 'bg-red-100 text-red-700' },
    cancelled: { label: 'Anulada', className: 'bg-red-100 text-red-700' },
  };

  const config = statusConfig[status] || { label: status, className: 'bg-gray-100 text-gray-700' };
  return <Badge variant="secondary" className={cn('text-xs', config.className)}>{config.label}</Badge>;
};

export const VehicleFullHistory: React.FC<VehicleFullHistoryProps> = ({
  history,
  summary,
  isLoading,
  error,
  showSensitiveData,
  onGeneratePDF,
  isGeneratingPDF
}) => {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-6 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-700 font-medium">Error al cargar el historial</p>
          <p className="text-red-600 text-sm mt-1">{error.message}</p>
        </CardContent>
      </Card>
    );
  }

  if (!history || history.length === 0) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-6 text-center">
          <Car className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <p className="text-amber-700 font-medium">No se encontraron servicios para esta patente</p>
          <p className="text-amber-600 text-sm mt-1">Verifique que la patente ingresada sea correcta</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con información del vehículo */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-full bg-violet-100">
            <Car className="h-6 w-6 text-violet-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              {summary?.vehicleBrand} {summary?.vehicleModel}
            </h3>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 font-mono text-sm">
                {summary?.licensePlate}
              </Badge>
              {summary?.firstServiceDate && summary?.lastServiceDate && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatForDisplay(summary.firstServiceDate)} - {formatForDisplay(summary.lastServiceDate)}
                </span>
              )}
            </div>
          </div>
        </div>
        
        <Button 
          onClick={onGeneratePDF} 
          disabled={isGeneratingPDF}
          className="bg-violet-600 hover:bg-violet-700 text-white"
        >
          <Download className="h-4 w-4 mr-2" />
          {isGeneratingPDF ? 'Generando...' : 'Generar Informe PDF'}
        </Button>
      </div>

      {/* Métricas */}
      {summary && (
        <VehicleFullHistoryMetrics summary={summary} showSensitiveData={showSensitiveData} />
      )}

      {/* Tabla de historial */}
      <Card className="border-border/50 overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-violet-600 to-violet-700 text-white py-3 px-4">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Historial Completo de Servicios ({history.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs font-semibold">Fecha</TableHead>
                  <TableHead className="text-xs font-semibold">Folio</TableHead>
                  <TableHead className="text-xs font-semibold">Tipo</TableHead>
                  <TableHead className="text-xs font-semibold">Cliente</TableHead>
                  <TableHead className="text-xs font-semibold">Cotización</TableHead>
                  <TableHead className="text-xs font-semibold">OC</TableHead>
                  <TableHead className="text-xs font-semibold">Factura</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Valor</TableHead>
                  <TableHead className="text-xs font-semibold">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((entry, index) => (
                  <TableRow 
                    key={entry.id}
                    className={cn(
                      "hover:bg-violet-50/50 transition-colors",
                      index % 2 === 0 ? "bg-white" : "bg-muted/20"
                    )}
                  >
                    <TableCell className="text-sm">
                      <div className="flex flex-col">
                        <span>{formatForDisplay(entry.serviceDate)}</span>
                        {entry.requestDate && (
                          <span className="text-xs text-muted-foreground">
                            Sol: {formatForDisplay(entry.requestDate)}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm font-medium text-violet-700">
                      {entry.folio}
                    </TableCell>
                    <TableCell className="text-sm">
                      {entry.serviceType.name}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{entry.client.name}</span>
                        {entry.client.department && (
                          <span className="text-xs text-muted-foreground">{entry.client.department}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {entry.quoteNumber ? (
                        <Badge variant="outline" className="bg-cyan-50 text-cyan-700 border-cyan-200 text-xs">
                          <FileText className="h-3 w-3 mr-1" />
                          {entry.quoteNumber}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {entry.purchaseOrderNumber || entry.purchaseOrder ? (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                          <ShoppingCart className="h-3 w-3 mr-1" />
                          {entry.purchaseOrderNumber || entry.purchaseOrder}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {entry.invoice ? (
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 text-xs w-fit">
                            <Receipt className="h-3 w-3 mr-1" />
                            {entry.invoice.folio}
                          </Badge>
                          {entry.invoice.numeroFiscal && (
                            <span className="text-xs text-muted-foreground">
                              N° {entry.invoice.numeroFiscal}
                            </span>
                          )}
                          {getInvoiceStatusBadge(entry.invoice.status)}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {showSensitiveData ? (
                        <span className="text-violet-700">{formatCurrency(entry.value)}</span>
                      ) : (
                        <span className="text-muted-foreground">••••••</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(entry.status)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
