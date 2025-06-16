
import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Checkbox } from "@/components/ui/checkbox";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { vehicleEquipment } from '@/data/equipmentData';
import { InspectionFormValues } from '@/schemas/inspectionSchema';

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

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-white">Inventario del Vehículo</h3>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={handleSelectAll}>Marcar Todo</Button>
          <Button type="button" size="sm" variant="outline" onClick={handleDeselectAll}>Desmarcar Todo</Button>
        </div>
      </div>
      
      <div className="bg-slate-800/50 rounded-md p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {vehicleEquipment[0].items.map((item) => (
            <FormField
              key={item.id}
              control={form.control}
              name="equipment"
              render={({ field }) => {
                const fieldValue = Array.isArray(field.value) ? field.value : [];
                return (
                  <FormItem className="flex flex-row items-start space-x-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        className="border-slate-500 data-[state=checked]:bg-tms-green data-[state=checked]:border-tms-green mt-1"
                        checked={fieldValue.includes(item.id)}
                        onCheckedChange={(checked) => {
                          return checked
                            ? field.onChange([...fieldValue, item.id])
                            : field.onChange(
                                fieldValue.filter(
                                  (value) => value !== item.id
                                )
                              );
                        }}
                      />
                    </FormControl>
                    <FormLabel className="font-normal text-gray-300 text-sm leading-tight">
                      {item.name}
                    </FormLabel>
                  </FormItem>
                );
              }}
            />
          ))}
        </div>
      </div>
      <FormMessage className="text-red-400">{form.formState.errors.equipment?.message}</FormMessage>
    </div>
  );
};
