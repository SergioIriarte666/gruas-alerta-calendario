import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { FileText, User, Truck, MapPin, DollarSign, Users, Receipt } from 'lucide-react';
import { cn, toTitleCase } from '@/lib/utils';

interface FormSummaryPanelProps {
  folio: string;
  clientName: string;
  serviceTypeName: string;
  value: number;
  totalCommissions: number;
  totalCosts: number;
  operatorsCount: number;
  craneName: string;
  origin: string;
  destination: string;
  status: string;
  isEditing: boolean;
}

export const FormSummaryPanel = ({
  folio,
  clientName,
  serviceTypeName,
  value,
  totalCommissions,
  totalCosts,
  operatorsCount,
  craneName,
  origin,
  destination,
  status,
  isEditing,
}: FormSummaryPanelProps) => {
  const netMargin = value - totalCommissions - totalCosts;
  const marginPercentage = value > 0 ? ((netMargin / value) * 100).toFixed(1) : '0.0';

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
  };

  const getStatusBadge = () => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      pending: { label: 'Pendiente', className: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/30' },
      in_progress: { label: 'En Progreso', className: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30' },
      completed: { label: 'Completado', className: 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30' },
      invoiced: { label: 'Facturado', className: 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30' },
      cancelled: { label: 'Cancelado', className: 'bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30' },
    };
    const config = statusConfig[status] || statusConfig.pending;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  return (
    <Card className="bg-gradient-to-b from-card to-muted/30 border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-violet-500" />
            Resumen del Servicio
          </span>
          {getStatusBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Folio */}
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Folio:</span>
          <span className="text-sm font-mono font-semibold text-violet-600 dark:text-violet-400">
            {folio || 'Auto-generado'}
          </span>
        </div>

        {/* Cliente */}
        {clientName && (
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Cliente:</span>
            <span className="text-sm font-medium truncate">{toTitleCase(clientName)}</span>
          </div>
        )}

        {/* Tipo de Servicio */}
        {serviceTypeName && (
          <div className="flex items-start gap-2">
            <Truck className="h-4 w-4 text-muted-foreground mt-0.5" />
            <span className="text-xs text-muted-foreground">Tipo:</span>
            <Badge variant="outline" className="text-xs">
              {serviceTypeName}
            </Badge>
          </div>
        )}

        {/* Ubicación */}
        {(origin || destination) && (
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div className="text-xs space-y-1">
              {origin && <div className="truncate"><span className="text-muted-foreground">Origen:</span> {origin}</div>}
              {destination && <div className="truncate"><span className="text-muted-foreground">Destino:</span> {destination}</div>}
            </div>
          </div>
        )}

        {/* Recursos */}
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Recursos:</span>
          <div className="flex gap-1">
            {craneName && (
              <Badge variant="secondary" className="text-xs">
                🚛 {craneName}
              </Badge>
            )}
            {operatorsCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                👷 {operatorsCount} op.
              </Badge>
            )}
          </div>
        </div>

        <Separator className="my-3" />

        {/* Financiero */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Financiero:</span>
          </div>
          
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valor:</span>
              <span className="font-semibold text-green-600 dark:text-green-400">
                {formatCurrency(value)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Comisiones:</span>
              <span className="text-orange-600 dark:text-orange-400">
                -{formatCurrency(totalCommissions)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Costos:</span>
              <span className="text-red-600 dark:text-red-400">
                -{formatCurrency(totalCosts)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Margen:</span>
              <span className={cn(
                "font-bold",
                netMargin >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
              )}>
                {formatCurrency(netMargin)}
              </span>
            </div>
          </div>

          {/* Barra de margen */}
          <div className="mt-2">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Margen neto</span>
              <span className={cn(
                "font-medium",
                parseFloat(marginPercentage) >= 30 ? "text-green-600 dark:text-green-400" :
                parseFloat(marginPercentage) >= 15 ? "text-yellow-600 dark:text-yellow-400" :
                "text-red-600 dark:text-red-400"
              )}>
                {marginPercentage}%
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-300",
                  parseFloat(marginPercentage) >= 30 ? "bg-green-500" :
                  parseFloat(marginPercentage) >= 15 ? "bg-yellow-500" :
                  "bg-red-500"
                )}
                style={{ width: `${Math.min(Math.max(parseFloat(marginPercentage), 0), 100)}%` }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
