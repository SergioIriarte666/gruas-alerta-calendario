import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Tag, FileText } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { CostCategory } from '@/types/costs';
import { CostFormValues } from '@/schemas/costSchema';
import { CostCombobox } from './CostCombobox';
import DatePickerInput from '@/components/common/DatePickerInput';
import { ColoredSectionCard } from '@/components/services/form/ColoredSectionCard';
import { useAutoClassify } from '@/hooks/useAutoClassify';
import { AiCategorySuggestion } from './AiCategorySuggestion';

interface CostFormStep1Props {
  form: UseFormReturn<CostFormValues>;
  categories: CostCategory[];
  isLoadingCategories: boolean;
  isNewCost?: boolean;
  onServiceExpenseSelect?: () => void;
}

export const CostFormStep1 = ({
  form,
  categories,
  isLoadingCategories,
  isNewCost = false,
  onServiceExpenseSelect,
}: CostFormStep1Props) => {
  const watchedDescription = form.watch('description');
  const watchedCategoryId = form.watch('category_id');

  const { suggestion, isClassifying, categoryName, source, clearSuggestion } = useAutoClassify(
    watchedDescription || '',
    watchedCategoryId || null,
  );

  const handleApplySuggestion = () => {
    if (!suggestion?.category_id) return;
    form.setValue('category_id', suggestion.category_id);
    if (suggestion.subcategory) {
      form.setValue('subcategory', suggestion.subcategory);
    }
    // Set default cost center from category
    const category = categories.find(cat => cat.id === suggestion.category_id);
    if (category?.default_cost_center_id) {
      const currentCostCenterId = form.getValues('cost_center_id');
      if (!currentCostCenterId || currentCostCenterId === 'none') {
        form.setValue('cost_center_id', category.default_cost_center_id);
      }
    }
    clearSuggestion();
  };

  return (
    <div className="space-y-4">
      <ColoredSectionCard
        title="Información Básica"
        icon={<FileText className="size-4" />}
        color="purple"
        required
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField name="date" control={form.control} render={({ field }) => (
              <FormItem>
                <Label className="flex items-center gap-2 text-foreground">
                  <Calendar className="size-4" />
                  Fecha *
                </Label>
                <FormControl>
                  <DatePickerInput
                    value={field.value || ''}
                    onChange={field.onChange}
                    placeholder="Seleccionar fecha"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField name="category_id" control={form.control} render={({ field }) => (
              <FormItem>
                <Label className="flex items-center gap-2 text-foreground">
                  <Tag className="size-4" />
                  Categoría *
                </Label>
                <Select 
                  onValueChange={(value) => {
                    const category = categories.find(cat => cat.id === value);
                    field.onChange(value);

                    const currentCostCenterId = form.getValues('cost_center_id');
                    if (!currentCostCenterId || currentCostCenterId === 'none') {
                      form.setValue('cost_center_id', category?.default_cost_center_id || 'none');
                    }
                    
                    if (category?.name === 'Gastos de Servicios' && isNewCost && onServiceExpenseSelect) {
                      const currentAmount = Number(form.getValues('amount') || 0);
                      if (!currentAmount || isNaN(currentAmount)) {
                        form.setValue('amount', 0);
                      }
                    }
                  }}
                  value={field.value} 
                  disabled={isLoadingCategories}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione una categoría" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
          </div>

          <FormField name="description" control={form.control} render={({ field }) => {
            const isLongText = (field.value || '').length > 80;
            return (
              <FormItem>
                <Label className="flex items-center gap-2 text-foreground">
                  <FileText className="size-4" />
                  Descripción *
                </Label>
                <FormControl>
                  {isLongText ? (
                    <Textarea
                      value={field.value || ''}
                      onChange={(e) => field.onChange(e.target.value)}
                      placeholder="Describe el costo o gasto..."
                      className="min-h-16 resize-y"
                    />
                  ) : (
                    <CostCombobox
                      value={field.value || ''}
                      onValueChange={field.onChange}
                      placeholder="Describe el costo o gasto..."
                      type="description"
                    />
                  )}
                </FormControl>
                <AiCategorySuggestion
                  categoryName={categoryName}
                  subcategory={suggestion?.subcategory || null}
                  isClassifying={isClassifying}
                  onApply={handleApplySuggestion}
                  source={source}
                  className="mt-1"
                />
                <FormMessage />
              </FormItem>
            );
          }} />
        </div>
      </ColoredSectionCard>
    </div>
  );
};
