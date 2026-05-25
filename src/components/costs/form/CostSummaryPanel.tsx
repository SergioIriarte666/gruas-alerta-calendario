import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Receipt, Calendar, Tag, DollarSign, Truck, User, FileText, Building2, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CostSummaryPanelProps {
  date: string;
  categoryName: string;
  subcategory: string;
  description: string;
  amount: number;
  craneName: string;
  operatorName: string;
  serviceFolio: string;
  costCenterName: string;
  supplierName: string;
  notes: string;
  isEditing: boolean;
  isPiezasYRepuestos?: boolean;
  partName?: string;
  quantity?: number;
  unitPrice?: number;
}

export const CostSummaryPanel = ({
  date,
  categoryName,
  subcategory,
  description,
  amount,
  craneName,
  operatorName,
  serviceFolio,
  costCenterName,
  supplierName,
  notes,
  isEditing,
  isPiezasYRepuestos,
  partName,
  quantity,
  unitPrice,
}: CostSummaryPanelProps) => {
  const formatCurrency = (value: number) => {
    return value.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Sin fecha';
    try {
      const [year, month, day] = dateStr.split('-');
      return `${day}/${month}/${year}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <Card className="bg-gradient-to-b from-card to-muted/30 border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Receipt className="size-4 text-violet-500" />
            Resumen del Costo
          </span>
          <Badge variant="outline" className={cn(
            "text-xs",
            isEditing 
              ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30"
              : "bg-violet-500/20 text-violet-700 dark:text-violet-300 border-violet-500/30"
          )}>
            {isEditing ? 'Editando' : 'Nuevo'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Fecha */}
        <div className="flex items-center gap-2">
          <Calendar className="size-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Fecha:</span>
          <span className="text-sm font-medium">{formatDate(date)}</span>
        </div>

        {/* Categoría */}
        {categoryName && (
          <div className="flex items-center gap-2">
            <Tag className="size-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Categoría:</span>
            <Badge variant="secondary" className="text-xs">
              {categoryName}
            </Badge>
          </div>
        )}

        {/* Subcategoría */}
        {subcategory && (
          <div className="flex items-center gap-2">
            <Tag className="size-4 text-muted-foreground opacity-50" />
            <span className="text-xs text-muted-foreground">Subcategoría:</span>
            <span className="text-sm">{subcategory}</span>
          </div>
        )}

        {/* Descripción */}
        {description && (
          <div className="flex items-start gap-2">
            <FileText className="size-4 text-muted-foreground mt-0.5" />
            <div className="flex-1 min-w-0">
              <span className="text-xs text-muted-foreground block">Descripción:</span>
              <span className="text-sm line-clamp-2">{description}</span>
            </div>
          </div>
        )}

        <Separator className="my-3" />

        {/* Monto */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="size-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Monto Total:</span>
          </div>
          <span className={cn(
            "text-lg font-bold",
            amount > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
          )}>
            {formatCurrency(amount)}
          </span>
        </div>

        {/* Detalles de Piezas y Repuestos */}
        {isPiezasYRepuestos && partName && (
          <>
            <Separator className="my-3" />
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Package className="size-3" />
                Detalles de Pieza
              </div>
              <div className="bg-muted/50 rounded-lg p-2 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pieza:</span>
                  <span className="font-medium truncate max-w-[120px]">{partName}</span>
                </div>
                {quantity && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cantidad:</span>
                    <span className="font-medium">{quantity}</span>
                  </div>
                )}
                {unitPrice && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">P. Unitario:</span>
                    <span className="font-medium">{formatCurrency(unitPrice)}</span>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Asociaciones */}
        {(craneName || operatorName || serviceFolio || costCenterName || supplierName) && (
          <>
            <Separator className="my-3" />
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Building2 className="size-3" />
                Asociaciones
              </div>
              <div className="flex flex-wrap gap-1">
                {craneName && (
                  <Badge variant="outline" className="text-xs">
                    🚛 {craneName}
                  </Badge>
                )}
                {operatorName && (
                  <Badge variant="outline" className="text-xs">
                    👷 {operatorName}
                  </Badge>
                )}
                {serviceFolio && (
                  <Badge variant="outline" className="text-xs font-mono">
                    📋 {serviceFolio}
                  </Badge>
                )}
                {costCenterName && (
                  <Badge variant="outline" className="text-xs">
                    🏢 {costCenterName}
                  </Badge>
                )}
                {supplierName && (
                  <Badge variant="outline" className="text-xs">
                    🏭 {supplierName}
                  </Badge>
                )}
              </div>
            </div>
          </>
        )}

        {/* Notas */}
        {notes && (
          <>
            <Separator className="my-3" />
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Notas:</span>
              <p className="text-xs text-muted-foreground italic line-clamp-3 bg-muted/30 rounded p-2">
                {notes}
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
