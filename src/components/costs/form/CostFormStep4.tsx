import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { FormControl, FormField, FormItem } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { StickyNote } from 'lucide-react';
import { CostFormValues } from '@/schemas/costSchema';
import { ColoredSectionCard } from '@/components/services/form/ColoredSectionCard';

interface CostFormStep4Props {
  form: UseFormReturn<CostFormValues>;
}

export const CostFormStep4 = ({ form }: CostFormStep4Props) => {
  return (
    <div className="space-y-4">
      <ColoredSectionCard
        title="Información Adicional"
        icon={<StickyNote className="h-4 w-4" />}
        color="amber"
      >
        <FormField name="notes" control={form.control} render={({ field }) => (
          <FormItem>
            <Label className="text-foreground">Notas y Observaciones</Label>
            <FormControl>
              <Textarea 
                {...field} 
                value={field.value ?? ''} 
                className="min-h-[120px]" 
                placeholder="Agrega notas adicionales, observaciones o detalles importantes..."
              />
            </FormControl>
          </FormItem>
        )} />
      </ColoredSectionCard>
    </div>
  );
};
