
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
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-foreground">Inventario del Vehículo</h3>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={handleSelectAll}>
            Marcar Todo
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={handleDeselectAll}>
            Desmarcar Todo
          </Button>
        </div>
      </div>
      
      <div className="bg-card border border-border rounded-md p-4">
        <FormField
          control={form.control}
          name="equipment"
          render={({ field }) => {
            const fieldValue = Array.isArray(field.value) ? field.value : [];
            
            return (
              <FormItem>
                <div className="space-y-4">
                  {/* Tabla de equipamiento con 3 columnas */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                            className="flex items-center justify-between p-3 border border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                          >
                            <span className="text-foreground text-sm font-medium flex-1">
                              {item.name}
                            </span>
                            <div className="ml-3 flex-shrink-0">
                              {isChecked ? (
                                <div className="size-6 rounded-full bg-green-500 flex items-center justify-center">
                                  <Check className="size-4 text-white" />
                                </div>
                              ) : (
                                <div className="size-6 rounded-full bg-red-500 flex items-center justify-center">
                                  <X className="size-4 text-white" />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
                <FormMessage className="text-red-500" />
              </FormItem>
            );
          }}
        />
      </div>
    </div>
  );
};
