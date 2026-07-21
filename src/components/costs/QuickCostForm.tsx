import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import DatePickerInput from '@/components/common/DatePickerInput';
import { Zap, ChevronDown, ChevronUp, Loader2, Save, Plus } from 'lucide-react';
import { useCostCategories } from '@/hooks/useCostCategories';
import { useCostSubcategories } from '@/hooks/useCostSubcategories';
import { useOperatorsData } from '@/hooks/operators/useOperatorsData';
import { useCranes } from '@/hooks/useCranes';
import { useCostCenters } from '@/hooks/useCostCenters';
import { useAddCost } from '@/hooks/useCosts';
import { getCurrentChileDateString } from '@/utils/timezoneUtils';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { SupplierCombobox } from '@/components/costs/form/SupplierSelector';
import { useAutoClassify } from '@/hooks/useAutoClassify';
import { AiCategorySuggestion } from '@/components/costs/form/AiCategorySuggestion';

const quickCostSchema = z.object({
  date: z.string().min(1, 'La fecha es requerida'),
  category_id: z.string().min(1, 'La categoría es requerida'),
  subcategory: z.string().optional(),
  description: z.string().min(1, 'La descripción es requerida'),
  amount: z.number().min(1, 'El monto debe ser mayor a 0'),
  // Campos opcionales expandibles
  crane_id: z.string().optional(),
  operator_id: z.string().optional(),
  supplier_id: z.string().optional(),
  cost_center_id: z.string().optional(),
  notes: z.string().optional(),
  is_paid: z.boolean().optional().default(false),
  payment_date: z.string().optional(),
});

type QuickCostFormValues = z.infer<typeof quickCostSchema>;

interface QuickCostFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const QuickCostForm = ({ isOpen, onClose, onSuccess }: QuickCostFormProps) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { mutate: addCost, isPending } = useAddCost();
  
  const { data: categories = [] } = useCostCategories();
  const { operationalCranes: cranes } = useCranes();
  const { data: operators = [] } = useOperatorsData();
  const { data: costCenters = [] } = useCostCenters();
  
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const { subcategories } = useCostSubcategories(selectedCategoryId);

  const [isPaid, setIsPaid] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isValid }
  } = useForm<QuickCostFormValues>({
    resolver: zodResolver(quickCostSchema),
    defaultValues: {
      date: getCurrentChileDateString(),
      category_id: '',
      subcategory: '',
      description: '',
      amount: 0,
      crane_id: 'none',
      operator_id: 'none',
      supplier_id: 'none',
      cost_center_id: 'none',
      notes: '',
    },
    mode: 'onChange',
  });

  const watchedCategoryId = watch('category_id');
  const watchedAmount = watch('amount');
  const watchedDate = watch('date');
  const watchedDescription = watch('description');

  const { suggestion, isClassifying, categoryName, source, clearSuggestion } = useAutoClassify(
    watchedDescription || '',
    watchedCategoryId || null,
  );

  const handleApplySuggestion = () => {
    if (!suggestion?.category_id) return;
    setValue('category_id', suggestion.category_id);
    setSelectedCategoryId(suggestion.category_id);
    if (suggestion.subcategory) {
      setValue('subcategory', suggestion.subcategory);
    }
    clearSuggestion();
  };

  useEffect(() => {
    if (watchedCategoryId && watchedCategoryId !== selectedCategoryId) {
      setSelectedCategoryId(watchedCategoryId);
      setValue('subcategory', '');
    }
  }, [watchedCategoryId, selectedCategoryId, setValue]);

  useEffect(() => {
    if (isOpen) {
      reset({
        date: getCurrentChileDateString(),
        category_id: '',
        subcategory: '',
        description: '',
        amount: 0,
        crane_id: 'none',
        operator_id: 'none',
        supplier_id: 'none',
        cost_center_id: 'none',
        notes: '',
        is_paid: false,
        payment_date: '',
      });
      setShowAdvanced(false);
      setSelectedCategoryId('');
      setIsPaid(false);
    }
  }, [isOpen, reset]);

  const watchedPaymentDate = watch('payment_date');
  // Prellenar payment_date con la fecha del costo cuando se marca como pagado
  useEffect(() => {
    if (isPaid && !watchedPaymentDate && watch('date')) {
      setValue('payment_date', watch('date'));
    }
    if (!isPaid && watchedPaymentDate) {
      setValue('payment_date', '');
    }
  }, [isPaid, watchedPaymentDate, setValue, watch]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(value);
  };

  const onSubmit = (values: QuickCostFormValues) => {
    const submissionData = {
      date: values.date,
      category_id: values.category_id,
      subcategory: values.subcategory || null,
      description: values.description.trim(),
      amount: values.amount,
      crane_id: values.crane_id === 'none' ? null : values.crane_id,
      operator_id: values.operator_id === 'none' ? null : values.operator_id,
      supplier_id: values.supplier_id === 'none' ? null : values.supplier_id,
      cost_center_id: values.cost_center_id === 'none' ? null : values.cost_center_id,
      notes: values.notes?.trim() || null,
      service_id: null,
      service_folio: null,
      payment_date: isPaid ? (values.payment_date || values.date) : null,
    };

    addCost(submissionData, {
      onSuccess: () => {
        toast.success('Costo Agregado', { description: 'El costo se registró correctamente' });
        onSuccess?.();
        onClose();
      },
      onError: (error) => {
        toast.error('Error', { description: error.message || 'No se pudo guardar el costo' });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="finance-dialog sm:max-w-lg border-border/70 bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Zap className="size-5 text-primary" />
            Costo Rápido
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Vista previa del monto */}
          <div className="rounded-lg border border-primary/20 bg-gradient-to-r from-primary/10 to-info/10 p-4">
            <p className="text-sm text-muted-foreground">Monto a registrar</p>
            <p className="text-3xl font-bold text-primary">
              {formatCurrency(watchedAmount || 0)}
            </p>
          </div>

          {/* Campos esenciales */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Fecha *</Label>
              <DatePickerInput
                value={watchedDate}
                onChange={(date) => setValue('date', date)}
              />
            </div>

            <div className="space-y-2">
              <Label>Categoría *</Label>
              <Select
                value={watchedCategoryId}
                onValueChange={(value) => setValue('category_id', value)}
              >
                <SelectTrigger className={cn(!watchedCategoryId && 'border-destructive')}>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category_id && (
                <p className="text-xs text-destructive">{errors.category_id.message}</p>
              )}
            </div>
          </div>

          {/* Subcategoría dinámica */}
          {subcategories.length > 0 && (
            <div className="space-y-2">
              <Label>Subcategoría</Label>
              <Select
                value={watch('subcategory') || ''}
                onValueChange={(value) => setValue('subcategory', value === 'none' ? '' : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar subcategoría..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin subcategoría</SelectItem>
                  {subcategories.map((sub) => (
                    <SelectItem key={sub.id} value={sub.name}>
                      {sub.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Descripción *</Label>
            <Input
              {...register('description')}
              placeholder="Ej: Combustible estación Shell"
              className={cn(errors.description && 'border-destructive')}
            />
            {errors.description && (
              <p className="text-xs text-destructive">{errors.description.message}</p>
            )}
            <AiCategorySuggestion
              categoryName={categoryName}
              subcategory={suggestion?.subcategory || null}
              isClassifying={isClassifying}
              onApply={handleApplySuggestion}
              source={source}
              className="mt-1"
            />
          </div>

          <div className="space-y-2">
            <Label>Monto *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                type="number"
                {...register('amount', { valueAsNumber: true })}
                placeholder="0"
                className={cn('pl-7 text-lg font-semibold', errors.amount && 'border-destructive')}
              />
            </div>
            {errors.amount && (
              <p className="text-xs text-destructive">{errors.amount.message}</p>
            )}
          </div>

          {/* Checkbox marcar como pagado */}
          <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/30 p-3">
            <Checkbox
              id="quick-is-paid"
              checked={isPaid}
              onCheckedChange={(checked) => setIsPaid(Boolean(checked))}
            />
            <div className="space-y-0.5">
              <label htmlFor="quick-is-paid" className="text-sm font-medium text-foreground cursor-pointer">
                Marcar como pagado
              </label>
              <p className="text-xs text-muted-foreground">
                Por defecto, se usa la fecha del costo. Indica abajo la fecha real si fue distinta.
              </p>
            </div>
          </div>

          {isPaid && (
            <div className="space-y-2">
              <Label>Fecha real de pago</Label>
              <DatePickerInput
                value={watchedPaymentDate || ''}
                onChange={(date) => setValue('payment_date', date)}
              />
              <p className="text-xs text-muted-foreground">
                Si el pago se realizó en una fecha distinta a la de registro, indícala aquí.
              </p>
            </div>
          )}

          {/* Sección expandible de detalles */}
          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between rounded-xl border border-border/70 bg-background/60 text-muted-foreground hover:bg-accent/20" type="button">
                <span className="flex items-center gap-2">
                  <Plus className="size-4" />
                  Agregar detalles opcionales
                </span>
                {showAdvanced ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-3 border-t border-border/70 pt-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm">Grúa</Label>
                  <Select
                    value={watch('crane_id') || 'none'}
                    onValueChange={(value) => setValue('crane_id', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sin asignar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin asignar</SelectItem>
                      {cranes.map((crane) => (
                        <SelectItem key={crane.id} value={crane.id}>
                          {crane.licensePlate}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Operador</Label>
                  <Select
                    value={watch('operator_id') || 'none'}
                    onValueChange={(value) => setValue('operator_id', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sin asignar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin asignar</SelectItem>
                      {operators.map((op) => (
                        <SelectItem key={op.id} value={op.id}>
                          {op.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm">Proveedor</Label>
                  <SupplierCombobox
                    value={(() => {
                      const current = watch('supplier_id');
                      return current && current !== 'none' ? current : null;
                    })()}
                    onValueChange={(value) => setValue('supplier_id', value ?? 'none')}
                    placeholder="Sin asignar"
                    noneLabel="Sin asignar"
                    allowCreate
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Centro de Costo</Label>
                  <Select
                    value={watch('cost_center_id') || 'none'}
                    onValueChange={(value) => setValue('cost_center_id', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sin asignar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin asignar</SelectItem>
                      {costCenters.map((cc) => (
                        <SelectItem key={cc.id} value={cc.id}>
                          {cc.code} - {cc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Notas</Label>
                <Textarea
                  {...register('notes')}
                  placeholder="Notas adicionales..."
                  rows={2}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Botones */}
          <div className="flex gap-2 border-t border-border/70 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1 border-border/70 bg-background/60" type="button">
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit(onSubmit)}
              disabled={isPending || !isValid}
              className="flex-1"
              type="button"
            >
              {isPending ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <Save className="size-4 mr-2" />
              )}
              Guardar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
