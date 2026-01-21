import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, DollarSign, TrendingUp, AlertTriangle, FileText, Plus } from 'lucide-react';
import { Supplier } from '@/types/suppliers';
import { QuickSupplierModal } from '@/components/suppliers/QuickSupplierModal';

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
  const [showQuickModal, setShowQuickModal] = useState(false);

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

  const handleValueChange = (value: string) => {
    if (value === 'new_supplier') {
      setShowQuickModal(true);
    } else {
      onProviderChange(value);
    }
  };

  const handleSupplierCreated = (supplierId: string) => {
    onProviderChange(supplierId);
    setShowQuickModal(false);
  };

  return (
    <Card className="border-orange-200 bg-orange-50/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-700">
          <Building2 className="h-5 w-5" />
          Proveedor del Servicio Tercerizado
        </CardTitle>
        <div className="text-sm text-orange-600 bg-orange-100 p-2 rounded border border-orange-200">
          <AlertTriangle className="h-4 w-4 inline mr-1" />
          Este servicio será ejecutado por un proveedor externo. Los recursos propios (grúa/operador) no son requeridos.
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Selector de Proveedor */}
          <div className="space-y-2">
            <Label htmlFor="outsourcedProvider">
              Proveedor Tercero <span className="text-red-500">*</span>
            </Label>
            <Select 
              value={providerId || ''} 
              onValueChange={handleValueChange}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar proveedor" />
              </SelectTrigger>
              <SelectContent>
                {activeSuppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                    {supplier.phone && (
                      <span className="text-muted-foreground ml-2">
                        ({supplier.phone})
                      </span>
                    )}
                  </SelectItem>
                ))}
                <SelectItem value="new_supplier">
                  <div className="flex items-center gap-2 text-primary font-medium">
                    <Plus className="h-4 w-4" />
                    Crear nuevo proveedor...
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Costo del Tercero */}
          <div className="space-y-2">
            <Label htmlFor="outsourcedCost" className="flex items-center gap-1">
              <DollarSign className="h-3 w-3 text-orange-600" />
              Costo Tercero (CLP) <span className="text-red-500">*</span>
            </Label>
            <Input
              id="outsourcedCost"
              type="number"
              value={cost || ''}
              onChange={(e) => onCostChange(Number(e.target.value))}
              placeholder="0"
              min="0"
              disabled={disabled}
              className="border-orange-300 focus:border-orange-500"
            />
          </div>
        </div>

        {/* Notas del Servicio Tercero */}
        <div className="space-y-2">
          <Label htmlFor="outsourcedNotes" className="flex items-center gap-1">
            <FileText className="h-3 w-3 text-muted-foreground" />
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
          <div className={`p-4 rounded-lg border ${isLowMargin ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className={`h-4 w-4 ${isLowMargin ? 'text-amber-600' : 'text-green-600'}`} />
              <span className={`font-medium ${isLowMargin ? 'text-amber-700' : 'text-green-700'}`}>
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
                <div className="font-semibold text-orange-600">-{formatCurrency(cost)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Margen Neto:</span>
                <div className={`font-bold ${margin < 0 ? 'text-red-600' : isLowMargin ? 'text-amber-600' : 'text-green-600'}`}>
                  {formatCurrency(margin)} ({marginPercentage.toFixed(1)}%)
                </div>
              </div>
            </div>
            {isLowMargin && (
              <div className="mt-2 text-xs text-amber-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Margen bajo. Considera ajustar el valor del servicio o negociar el costo con el tercero.
              </div>
            )}
            {margin < 0 && (
              <div className="mt-2 text-xs text-red-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                ¡Atención! El costo del tercero supera el valor del servicio. Revisa los montos.
              </div>
          )}
        </div>
        )}
      </CardContent>

      <QuickSupplierModal
        isOpen={showQuickModal}
        onClose={() => setShowQuickModal(false)}
        onSuccess={handleSupplierCreated}
      />
    </Card>
  );
};
