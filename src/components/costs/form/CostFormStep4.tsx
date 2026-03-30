import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { FormControl, FormField, FormItem } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FileText, StickyNote } from 'lucide-react';
import { CostFormValues } from '@/schemas/costSchema';
import { ColoredSectionCard } from '@/components/services/form/ColoredSectionCard';

interface CostFormStep4Props {
  form: UseFormReturn<CostFormValues>;
  receiptUrls?: string[];
}

export const CostFormStep4 = ({ form, receiptUrls = [] }: CostFormStep4Props) => {
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

      {receiptUrls.length > 0 && (
        <ColoredSectionCard
          title="Comprobante"
          icon={<FileText className="h-4 w-4" />}
          color="purple"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {receiptUrls.map((url, idx) => (
              <a
                key={`${url}-${idx}`}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="block rounded-md border border-border overflow-hidden bg-background"
              >
                <img
                  src={url}
                  alt={`Comprobante ${idx + 1}`}
                  className="w-full h-64 object-contain bg-black/5"
                  loading="eager"
                />
              </a>
            ))}
          </div>
        </ColoredSectionCard>
      )}
    </div>
  );
};
