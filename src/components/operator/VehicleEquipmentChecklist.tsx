
import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { FormField, FormItem, FormMessage } from '@/components/ui/form';
import { useInspectionEquipment } from '@/hooks/useInspectionEquipment';
import { InspectionFormValues } from '@/schemas/inspectionSchema';
import { Check, X } from 'lucide-react';

interface VehicleEquipmentChecklistProps {
  form: UseFormReturn<InspectionFormValues>;
}

export const VehicleEquipmentChecklist = ({ form }: VehicleEquipmentChecklistProps) => {
  const { activeItems, isLoading } = useInspectionEquipment();
  const allItemIds = activeItems.map(item => item.id);

  const handleSelectAll = () => {
    form.setValue('equipment', allItemIds, { shouldValidate: true });
  };

  const handleDeselectAll = () => {
    form.setValue('equipment', [], { shouldValidate: true });
  };

  const handleItemToggle = (itemId: string) => {
    const currentEquipment = form.getValues('equipment') || [];
    const newEquipment = currentEquipment.includes(itemId)
      ? currentEquipment.filter(id => id !== itemId)
      : [...currentEquipment, itemId];
    
    form.setValue('equipment', newEquipment, { shouldValidate: true });
  };

  return (
    <section className="operator-inspection-card space-y-4 rounded-3xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="operator-native-eyebrow">Paso 2</p>
          <h3 className="mt-1 text-lg font-semibold text-foreground">Equipamiento</h3>
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={handleSelectAll} className="rounded-xl">
            Todo
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={handleDeselectAll} className="rounded-xl">
            Limpiar
          </Button>
        </div>
      </div>
      
      <div>
        <FormField
          control={form.control}
          name="equipment"
          render={({ field }) => {
            const fieldValue = Array.isArray(field.value) ? field.value : [];
            
            return (
              <FormItem>
                <div className="space-y-4">
                  {/* Tabla de equipamiento con 3 columnas */}
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
                    {isLoading ? (
                      <div className="col-span-full py-4 text-sm text-muted-foreground">
                        Cargando inventario...
                      </div>
                    ) : (
                      activeItems.map((item) => {
                        const isChecked = fieldValue.includes(item.id);
                        return (
                          <div
                            key={item.id}
                            onClick={() => handleItemToggle(item.id)}
                            className="flex min-h-12 cursor-pointer items-center justify-between rounded-2xl border border-border bg-background p-3 transition-colors hover:bg-muted/50"
                          >
                            <span className="text-foreground text-sm font-medium flex-1">
                              {item.name}
                            </span>
                            <div className="ml-3 flex-shrink-0">
                              {isChecked ? (
                                <div className="flex size-6 items-center justify-center rounded-full bg-success">
                                  <Check className="size-4 text-success-foreground" />
                                </div>
                              ) : (
                                <div className="flex size-6 items-center justify-center rounded-full bg-danger">
                                  <X className="size-4 text-danger-foreground" />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
                <FormMessage className="text-danger-text" />
              </FormItem>
            );
          }}
        />
      </div>
    </section>
  );
};
