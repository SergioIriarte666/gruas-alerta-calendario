import { businessClock } from '@/utils/businessClock';

import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CostFormData } from '@/types/costs';
import { LOWBOY_CRANE_IDS, type EntityKey } from '@/lib/entities';
import { useAddCost } from '@/hooks/useCosts';
import { useCostSubcategories } from '@/hooks/useCostSubcategories';
import { toast } from 'sonner';
import { Fuel, Car, Calculator, Tag } from 'lucide-react';

interface ServiceExpenseModalsProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: (totalAmount?: number) => void;
  baseData: {
    date: string;
    category_id: string;
    crane_id?: string;
    operator_id?: string;
    service_id?: string;
    service_folio?: string;
  };
}

export const ServiceExpenseModals = ({ isOpen, onClose, onComplete, baseData }: ServiceExpenseModalsProps) => {
  const { mutate: addCost } = useAddCost();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Cargar subcategorías desde la DB
  const { subcategories, isLoading } = useCostSubcategories(baseData.category_id);
  
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const updateAmount = (subcategoryName: string, value: string) => {
    setAmounts(prev => ({ ...prev, [subcategoryName]: value }));
  };

  const currentTotal = useMemo(() => {
    return Object.values(amounts).reduce((total, val) => {
      const num = parseFloat(val);
      return total + (isNaN(num) ? 0 : num);
    }, 0);
  }, [amounts]);

  const getSectionIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('combustible')) return <Fuel className="size-5 text-danger-text" />;
    if (lower.includes('peaje')) return <Car className="size-5 text-warning-text" />;
    return <Tag className="size-5 text-primary" />;
  };

  const getDefaultDescription = (subcategoryName: string) => {
    const now = businessClock.now();
    const dateString = businessClock.format(now, 'dd/MM/yyyy');
    const timeString = businessClock.format(now, 'HH:mm');
    const serviceInfo = baseData.service_folio ? ` - ${baseData.service_folio}` : '';
    return `${subcategoryName} ${dateString} ${timeString}${serviceInfo}`;
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    const validEntries = Object.entries(amounts).filter(([_, val]) => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0;
    });

    if (validEntries.length === 0) {
      toast.error("Error de Validación", { description: "Debe ingresar al menos un monto mayor a 0." });
      setIsSubmitting(false);
      return;
    }

    let successCount = 0;
    const totalAmount = validEntries.reduce((sum, [_, val]) => sum + parseFloat(val), 0);

    // Entidad derivada de la grúa del servicio: LowBoy si el equipo pertenece a LowBoy,
    // en caso contrario Grúas 5 Norte.
    const effectiveCraneId = baseData.crane_id === 'none' ? undefined : baseData.crane_id;
    const craneEntity: EntityKey =
      effectiveCraneId && (LOWBOY_CRANE_IDS as readonly string[]).includes(effectiveCraneId)
        ? 'lowboy'
        : 'gruas_5_norte';

    const processNext = async (index: number) => {
      if (index >= validEntries.length) {
        setIsSubmitting(false);
        if (successCount === validEntries.length) {
          toast.success("Costos Guardados", { description: `Se registraron ${successCount} costos por $${totalAmount.toLocaleString()}.` });
          setAmounts({});
          if (onComplete) {
            onComplete(totalAmount);
          } else {
            onClose();
          }
        } else if (successCount > 0) {
          toast.warning("Guardado Parcial", { description: `Se guardaron ${successCount} de ${validEntries.length} costos.` });
          onComplete?.(totalAmount);
        } else {
          toast.error("Error al Guardar");
          onComplete?.(0);
        }
        return;
      }

      const [subcategoryName, val] = validEntries[index];
      const costData: CostFormData = {
        date: baseData.date,
        description: getDefaultDescription(subcategoryName),
        amount: parseFloat(val),
        category_id: baseData.category_id,
        crane_id: baseData.crane_id === 'none' ? null : baseData.crane_id,
        operator_id: baseData.operator_id === 'none' ? null : baseData.operator_id,
        service_id: baseData.service_id === 'none' ? null : baseData.service_id,
        service_folio: baseData.service_folio || null,
        subcategory: subcategoryName,
        notes: null,
        payment_date: baseData.date,
        // Entidad/financiador derivados de la grúa del servicio (LowBoy vs Grúas 5 Norte).
        entity: craneEntity,
        paid_by: craneEntity,
      };

      addCost(costData, {
        onSuccess: () => { successCount++; processNext(index + 1); },
        onError: () => { processNext(index + 1); },
      });
    };

    processNext(0);
  };

  const handleCancel = () => {
    setAmounts({});
    if (onComplete) {
      onComplete(0);
    } else {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="bg-card border max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-foreground">Desglosar Gastos de Servicios</DialogTitle>
          <p className="text-muted-foreground">
            Ingrese los montos específicos para cada tipo de gasto
          </p>
        </DialogHeader>

        {currentTotal > 0 && (
          <Card className="bg-success-soft border-success/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calculator className="size-5 text-success-text" />
                  <span className="font-medium text-success-text">Total Calculado:</span>
                </div>
                <span className="text-2xl font-bold text-success-text">${currentTotal.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <p className="text-muted-foreground text-center py-8">Cargando subcategorías...</p>
        ) : subcategories.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No hay subcategorías configuradas para esta categoría. Créalas en Configuración → Categorías.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 py-4">
            {subcategories.map((sub) => (
              <Card key={sub.id} className="bg-card border">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                    {getSectionIcon(sub.name)}
                    {sub.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Label className="text-sm font-medium text-foreground">Monto</Label>
                  <div className="relative mt-1">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={amounts[sub.name] || ''}
                      onChange={(e) => updateAmount(sub.name, e.target.value)}
                      className="pr-12"
                      placeholder="0.00"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">CLP</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="flex justify-between items-center pt-4 border-t border">
          <Button variant="outline" onClick={handleCancel}>
            {onComplete ? 'Cancelar Desglose' : 'Cancelar'}
          </Button>
          <div className="flex items-center gap-3">
            {currentTotal > 0 && (
              <span className="text-muted-foreground">
                Total: <span className="font-bold text-foreground">${currentTotal.toLocaleString()}</span>
              </span>
            )}
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || currentTotal <= 0}
              className="bg-success text-success-foreground hover:bg-success/90"
            >
              {isSubmitting ? 'Guardando...' : (onComplete ? 'Confirmar y Usar Total' : 'Guardar Gastos')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
