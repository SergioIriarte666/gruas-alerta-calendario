import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Building2, DollarSign, TrendingUp, AlertTriangle, FileText } from 'lucide-react';
import { Supplier } from '@/types/suppliers';
import { SupplierCombobox } from '@/components/costs/form/SupplierSelector';

interface OutsourcedProviderSectionProps {
  providerId?: string;
  cost: number;
  notes?: string;
  onProviderChange: (providerId: string) => void;
  onCostChange: (cost: number) => void;
  onNotesChange: (notes: string) => void;
  serviceValue: number;
  suppliers: Supplier[];
  disabled?: boolean;
}

export const OutsourcedProviderSection = ({
  providerId,
  cost,
  notes,
  onProviderChange,
  onCostChange,
  onNotesChange,
  serviceValue,
  suppliers,
  disabled = false
}: OutsourcedProviderSectionProps) => {
  // Calcular margen
  const margin = serviceValue - cost;
  const marginPercentage = serviceValue > 0 ? (margin / serviceValue) * 100 : 0;
  const isLowMargin = marginPercentage < 15 && serviceValue > 0;

  // Filtrar proveedores activos
  const activeSuppliers = suppliers.filter(s => s.is_active);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <Card className="border-warning bg-warning-soft/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-warning-text">
          <Building2 className="size-5" />
          Proveedor del Servicio Tercerizado
        </CardTitle>
        <div className="text-sm text-warning-text bg-warning-soft p-2 rounded border border-warning">
          <AlertTriangle className="size-4 inline mr-1" />
          Este servicio será ejecutado por un proveedor externo. Los recursos propios (grúa/operador) no son requeridos.
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Selector de Proveedor */}
          <div className="space-y-2">
            <Label htmlFor="outsourcedProvider">
              Proveedor Tercero <span className="text-danger-text">*</span>
            </Label>
            <SupplierCombobox
              value={providerId || null}
              onValueChange={(value) => onProviderChange(value || '')}
              placeholder="Seleccionar proveedor"
              allowCreate
              showNoneOption={false}
              options={activeSuppliers as Supplier[]}
              disabled={disabled}
            />
          </div>

          {/* Costo del Tercero */}
          <div className="space-y-2">
            <Label htmlFor="outsourcedCost" className="flex items-center gap-1">
              <DollarSign className="size-3 text-warning-text" />
              Costo Tercero (CLP) <span className="text-danger-text">*</span>
            </Label>
            <Input
              id="outsourcedCost"
              type="number"
              value={cost || ''}
              onChange={(e) => onCostChange(Number(e.target.value))}
              placeholder="0"
              min="0"
              disabled={disabled}
              className="border-warning focus:border-warning"
            />
          </div>
        </div>

        {/* Notas del Servicio Tercero */}
        <div className="space-y-2">
          <Label htmlFor="outsourcedNotes" className="flex items-center gap-1">
            <FileText className="size-3 text-muted-foreground" />
            Notas del Servicio Tercero
          </Label>
          <Textarea
            id="outsourcedNotes"
            value={notes || ''}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Ej: Operador: Juan Pérez | Grúa: ABCD-12 | Tel: +56 9 1234 5678"
            rows={2}
            disabled={disabled}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground">
            Incluye información del operador externo, patente de su grúa, contacto, etc.
          </p>
        </div>

        {/* Resumen de Margen */}
        {serviceValue > 0 && (
          <div className={`p-4 rounded-lg border ${isLowMargin ? 'bg-warning-soft border-warning' : 'bg-success-soft border-success'}`}>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className={`size-4 ${isLowMargin ? 'text-warning-text' : 'text-success-text'}`} />
              <span className={`font-medium ${isLowMargin ? 'text-warning-text' : 'text-success-text'}`}>
                Margen del Servicio
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Valor Servicio:</span>
                <div className="font-semibold">{formatCurrency(serviceValue)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Costo Tercero:</span>
                <div className="font-semibold text-warning-text">-{formatCurrency(cost)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Margen Neto:</span>
                <div className={`font-bold ${margin < 0 ? 'text-danger-text' : isLowMargin ? 'text-warning-text' : 'text-success-text'}`}>
                  {formatCurrency(margin)} ({marginPercentage.toFixed(1)}%)
                </div>
              </div>
            </div>
            {isLowMargin && (
              <div className="mt-2 text-xs text-warning-text flex items-center gap-1">
                <AlertTriangle className="size-3" />
                Margen bajo. Considera ajustar el valor del servicio o negociar el costo con el tercero.
              </div>
            )}
            {margin < 0 && (
              <div className="mt-2 text-xs text-danger-text flex items-center gap-1">
                <AlertTriangle className="size-3" />
                ¡Atención! El costo del tercero supera el valor del servicio. Revisa los montos.
              </div>
          )}
        </div>
        )}
      </CardContent>

    </Card>
  );
};
