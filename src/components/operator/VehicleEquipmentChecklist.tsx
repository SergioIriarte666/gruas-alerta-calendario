
import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { FormField, FormItem, FormMessage } from '@/components/ui/form';
import { vehicleEquipment } from '@/data/equipmentData';
import { InspectionFormValues } from '@/schemas/inspectionSchema';
import { Check, X } from 'lucide-react';

interface VehicleEquipmentChecklistProps {
  form: UseFormReturn<InspectionFormValues>;
}

export const VehicleEquipmentChecklist = ({ form }: VehicleEquipmentChecklistProps) => {
  const allItemIds = vehicleEquipment.flatMap(category => category.items.map(item => item.id));

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
        <h3 className="text-lg font-semibold text-white">Inventario del Vehículo</h3>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={handleSelectAll}>
            Marcar Todo
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={handleDeselectAll}>
            Desmarcar Todo
          </Button>
        </div>
      </div>
      
      <div className="bg-slate-800/50 rounded-md p-4">
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
                    {vehicleEquipment[0].items.map((item) => {
                      const isChecked = fieldValue.includes(item.id);
                      
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleItemToggle(item.id)}
                          className="flex items-center justify-between p-3 border border-slate-600 rounded-lg cursor-pointer hover:bg-slate-700/50 transition-colors"
                        >
                          <span className="text-gray-300 text-sm font-medium flex-1">
                            {item.name}
                          </span>
                          <div className="ml-3 flex-shrink-0">
                            {isChecked ? (
                              <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                                <Check className="w-4 h-4 text-white" />
                              </div>
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
                                <X className="w-4 h-4 text-white" />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <FormMessage className="text-red-400" />
              </FormItem>
            );
          }}
        />
      </div>
    </div>
  );
};
