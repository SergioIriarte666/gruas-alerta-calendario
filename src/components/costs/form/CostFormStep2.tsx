import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, Tag, Package, Phone, Hash, Gauge } from 'lucide-react';
import { CostCategory } from '@/types/costs';
import { CostFormValues } from '@/schemas/costSchema';
import { CostAmountSection } from './CostAmountSection';
import { CostCombobox } from './CostCombobox';
import { InventoryPurchaseFields } from './InventoryPurchaseFields';
import { useCostSubcategories } from '@/hooks/useCostSubcategories';
import { ColoredSectionCard } from '@/components/services/form/ColoredSectionCard';

interface CostFormStep2Props {
  form: UseFormReturn<CostFormValues>;
  categories: CostCategory[];
  isNewCost?: boolean;
  onServiceExpenseSelect?: () => void;
  calculatedServiceTotal?: number;
}

export const CostFormStep2 = ({
  form,
  categories,
  isNewCost = false,
  onServiceExpenseSelect,
  calculatedServiceTotal = 0,
}: CostFormStep2Props) => {
  const selectedCategoryId = form.watch('category_id');
  const selectedSubcategory = form.watch('subcategory');
  const selectedCategory = categories.find(cat => cat.id === selectedCategoryId);
  
  const { subcategories, isLoading: isLoadingSubcategories } = useCostSubcategories(selectedCategoryId);
  
  const isGastosDeServicios = selectedCategory?.name === 'Gastos de Servicios';
  const isMantenimiento = selectedCategory?.name === 'Mantenimiento';
  const isPiezasYRepuestos = isMantenimiento && selectedSubcategory === 'Piezas y Repuestos';
  const isInventario = selectedCategory?.name === 'Inventario';
  
  const hasSubcategories = subcategories.length > 0;

  const quantity = form.watch('quantity');
  const unitPrice = form.watch('unit_price');
  
  React.useEffect(() => {
    if (isPiezasYRepuestos && quantity && unitPrice) {
      const total = quantity * unitPrice;
      form.setValue('amount', total);
    }
  }, [quantity, unitPrice, isPiezasYRepuestos, form]);

  return (
    <div className="space-y-4">
      {/* Sección de Monto */}
      <ColoredSectionCard
        title="Monto"
        icon={<DollarSign className="h-4 w-4" />}
        color="green"
        required
      >
        <CostAmountSection
          form={form}
          isServiceExpense={isGastosDeServicios}
          onServiceExpenseClick={onServiceExpenseSelect}
          calculatedTotal={calculatedServiceTotal}
          showServiceButton={isNewCost && isGastosDeServicios && !!onServiceExpenseSelect}
        />
      </ColoredSectionCard>

      {/* Campos de Inventario */}
      {isInventario && (
        <InventoryPurchaseFields form={form} />
      )}

      {/* Subcategorías */}
      {selectedCategoryId && (
        <ColoredSectionCard
          title="Subcategoría"
          icon={<Tag className="h-4 w-4" />}
          color="cyan"
        >
          <FormField name="subcategory" control={form.control} render={({ field }) => (
            <FormItem>
              <Label className="text-foreground">
                {isGastosDeServicios ? 'Tipo de Gasto' : 
                 isMantenimiento ? 'Tipo de Mantenimiento' : 
                 'Subcategoría (Opcional)'}
              </Label>
              
              {hasSubcategories ? (
                <Select 
                  onValueChange={field.onChange} 
                  value={field.value || ''}
                  disabled={isLoadingSubcategories}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={
                        isLoadingSubcategories ? 'Cargando...' :
                        isGastosDeServicios ? 'Seleccione tipo de gasto' :
                        isMantenimiento ? 'Seleccione tipo de mantenimiento' :
                        'Seleccione subcategoría'
                      } />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {subcategories.map(sub => (
                      <SelectItem key={sub.id} value={sub.name}>
                        {sub.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <FormControl>
                  <CostCombobox
                    value={field.value || ''}
                    onValueChange={field.onChange}
                    placeholder="Ej: Papelería, Honorarios, Prima anual, Aguinaldo..."
                    type="subcategory"
                    categoryId={selectedCategoryId}
                  />
                </FormControl>
              )}
              <FormMessage />
            </FormItem>
          )} />
        </ColoredSectionCard>
      )}

      {/* Campos de Piezas y Repuestos */}
      {isPiezasYRepuestos && (
        <ColoredSectionCard
          title="Información de Piezas y Repuestos"
          icon={<Package className="h-4 w-4" />}
          color="blue"
          required
        >
          <p className="text-sm text-muted-foreground mb-4">
            Complete los detalles específicos de la pieza o repuesto
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField name="part_name" control={form.control} render={({ field }) => (
              <FormItem>
                <Label className="flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Nombre de la Pieza *
                </Label>
                <FormControl>
                  <CostCombobox
                    value={field.value || ''}
                    onValueChange={field.onChange}
                    placeholder="Ej: Filtro de aceite, Pastillas de freno..."
                    type="part_name"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField name="supplier_phone" control={form.control} render={({ field }) => (
              <FormItem>
                <Label className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Teléfono del Proveedor
                </Label>
                <FormControl>
                  <Input 
                    {...field} 
                    value={field.value || ''} 
                    placeholder="Ej: +56 9 1234 5678"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField name="quantity" control={form.control} render={({ field }) => (
              <FormItem>
                <Label className="flex items-center gap-2">
                  <Hash className="w-4 h-4" />
                  Cantidad *
                </Label>
                <FormControl>
                  <Input 
                    type="number" 
                    min="1" 
                    {...field} 
                    value={field.value || ''} 
                    placeholder="1"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField name="unit_price" control={form.control} render={({ field }) => (
              <FormItem>
                <Label className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Precio Unitario *
                </Label>
                <FormControl>
                  <Input 
                    type="number" 
                    step="0.01" 
                    min="0" 
                    {...field} 
                    value={field.value || ''} 
                    placeholder="0.00"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField name="kilometraje" control={form.control} render={({ field }) => (
              <FormItem>
                <Label className="flex items-center gap-2">
                  <Gauge className="w-4 h-4" />
                  Kilometraje (Opcional)
                </Label>
                <FormControl>
                  <Input 
                    type="number" 
                    min="0" 
                    {...field} 
                    value={field.value || ''} 
                    placeholder="Ej: 50000"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        </ColoredSectionCard>
      )}
    </div>
  );
};
