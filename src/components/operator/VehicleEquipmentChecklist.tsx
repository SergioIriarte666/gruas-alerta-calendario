
import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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

  const getFieldNameForCategory = (categoryId: string): keyof InspectionFormValues => {
    switch (categoryId) {
      case 'keys_collected':
        return 'keysCollected';
      case 'documents_collected':
        return 'documentsCollected';
      case 'client_exclusive_use':
        return 'clientExclusiveUse';
      default:
        return 'equipment';
    }
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
      
      <Accordion type="multiple" defaultValue={vehicleEquipment.map(c => c.id)} className="w-full">
        {vehicleEquipment.map((category) => {
          const fieldName = getFieldNameForCategory(category.id);
          
          return (
            <AccordionItem key={category.id} value={category.id} className="border-slate-700">
              <AccordionTrigger className="text-tms-green hover:no-underline">{category.name}</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 p-4 bg-slate-800/50 rounded-md">
                  {category.items.map((item) => (
                    <FormField
                      key={item.id}
                      control={form.control}
                      name={fieldName}
                      render={({ field }) => {
                        return (
                          <FormItem
                            key={item.id}
                            className="flex flex-row items-start space-x-3 space-y-0"
                          >
                            <FormControl>
                              <Checkbox
                                className="border-slate-500 data-[state=checked]:bg-tms-green data-[state=checked]:border-tms-green"
                                checked={field.value?.includes(item.id)}
                                onCheckedChange={(checked) => {
                                  return checked
                                    ? field.onChange([...(field.value || []), item.id])
                                    : field.onChange(
                                        field.value?.filter(
                                          (value) => value !== item.id
                                        )
                                      );
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal text-gray-300">
                              {item.name}
                            </FormLabel>
                          </FormItem>
                        );
                      }}
                    />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
      <FormMessage className="text-red-400">{form.formState.errors.equipment?.message}</FormMessage>
    </div>
  );
};
