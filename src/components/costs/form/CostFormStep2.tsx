import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, Tag, Package, Phone, Hash, Gauge } from 'lucide-react';
import { CostCategory } from '@/types/costs';
import { CostFormValues } from '@/schemas/costSchema';
import { CostAmountSection } from './CostAmountSection';
import { CostCombobox } from './CostCombobox';
import { InventoryPurchaseFields } from './InventoryPurchaseFields';
import { useCostSubcategories } from '@/hooks/useCostSubcategories';
import { ColoredSectionCard } from '@/components/services/form/ColoredSectionCard';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

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
  const CREATE_SUBCATEGORY_VALUE = '__create_subcategory__';
  const selectedCategoryId = form.watch('category_id');
  const selectedSubcategory = form.watch('subcategory');
  const selectedCategory = categories.find(cat => cat.id === selectedCategoryId);
  
  const {
    subcategories,
    isLoading: isLoadingSubcategories,
    createSubcategory,
    isCreating,
  } = useCostSubcategories(selectedCategoryId);
  
  const isGastosDeServicios = selectedCategory?.name === 'Gastos de Servicios';
  const isMantenimiento = selectedCategory?.name === 'Mantenimiento';
  const isPiezasYRepuestos = isMantenimiento && selectedSubcategory === 'Piezas y Repuestos';
  const isInventario = selectedCategory?.name === 'Inventario';
  
  const hasSubcategories = subcategories.length > 0;
  const selectedSubcategoryRow = subcategories.find(s => s.name === selectedSubcategory);

  const [isCreateSubcategoryOpen, setIsCreateSubcategoryOpen] = React.useState(false);
  const [newSubcategoryName, setNewSubcategoryName] = React.useState('');

  const quantity = form.watch('quantity');
  const unitPrice = form.watch('unit_price');
  
  React.useEffect(() => {
    if (isPiezasYRepuestos && quantity && unitPrice) {
      const total = quantity * unitPrice;
      form.setValue('amount', total);
    }
  }, [quantity, unitPrice, isPiezasYRepuestos, form]);

  React.useEffect(() => {
    setIsCreateSubcategoryOpen(false);
    setNewSubcategoryName('');
  }, [selectedCategoryId]);

  const handleSubcategoryChange = (value: string, onChange: (value: string) => void) => {
    if (value === CREATE_SUBCATEGORY_VALUE) {
      setIsCreateSubcategoryOpen(true);
      return;
    }
    onChange(value);
  };

  const handleCreateSubcategory = () => {
    const categoryId = selectedCategoryId;
    const name = newSubcategoryName.trim();

    if (!categoryId) return;

    if (!name) {
      toast.error('Ingresa un nombre de subcategoría');
      return;
    }

    const normalized = name.toLowerCase();
    const exists = subcategories.some(s => (s.name || '').trim().toLowerCase() === normalized);
    if (exists) {
      toast.error('Esa subcategoría ya existe en esta categoría');
      return;
    }

    const maxOrder = subcategories.reduce((max, sub) => Math.max(max, sub.display_order || 0), 0);

    createSubcategory(
      {
        category_id: categoryId,
        name,
        display_order: maxOrder + 1,
      },
      {
        onSuccess: (data: any) => {
          form.setValue('subcategory', data.name, { shouldDirty: true, shouldValidate: true });
          setIsCreateSubcategoryOpen(false);
          setNewSubcategoryName('');
        },
      }
    );
  };

  return (
    <div className="space-y-4">
      {/* Sección de Monto */}
      <ColoredSectionCard
        title="Monto"
        icon={<DollarSign className="size-4" />}
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
          icon={<Tag className="size-4" />}
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
                  onValueChange={(value) => handleSubcategoryChange(value, field.onChange)} 
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
                    <SelectSeparator />
                    <SelectItem value={CREATE_SUBCATEGORY_VALUE}>Crear subcategoría...</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="space-y-2">
                  <FormControl>
                    <CostCombobox
                      value={field.value || ''}
                      onValueChange={field.onChange}
                      placeholder="Ej: Papelería, Honorarios, Prima anual, Aguinaldo..."
                      type="subcategory"
                      categoryId={selectedCategoryId}
                    />
                  </FormControl>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsCreateSubcategoryOpen(true)}
                      disabled={isLoadingSubcategories}
                    >
                      Crear subcategoría...
                    </Button>
                  </div>
                </div>
              )}
              <FormMessage />
            </FormItem>
          )} />
        </ColoredSectionCard>
      )}

      <Dialog open={isCreateSubcategoryOpen} onOpenChange={setIsCreateSubcategoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva subcategoría</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-foreground">Nombre *</Label>
            <Input
              value={newSubcategoryName}
              onChange={(e) => setNewSubcategoryName(e.target.value)}
              placeholder="Ej: Certificados"
              disabled={isCreating}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCreateSubcategory();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateSubcategoryOpen(false)}
              disabled={isCreating}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleCreateSubcategory}
              disabled={isCreating || !newSubcategoryName.trim()}
            >
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedSubcategoryRow?.requires_location && (
        <ColoredSectionCard
          title="Ubicación / Tramo"
          icon={<Tag className="size-4" />}
          color="cyan"
          required
        >
          <FormField name="location_text" control={form.control} render={({ field }) => (
            <FormItem>
              <Label className="text-foreground">Ubicación / Tramo *</Label>
              <FormControl>
                <Input
                  {...field}
                  value={field.value || ''}
                  placeholder="Ej: Ruta 5 - Tramo X / Plaza Y"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </ColoredSectionCard>
      )}

      {selectedSubcategoryRow?.requires_document && (
        <ColoredSectionCard
          title="Documento"
          icon={<Tag className="size-4" />}
          color="cyan"
          required
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField name="document_type" control={form.control} render={({ field }) => (
              <FormItem>
                <Label className="text-foreground">Tipo de Documento</Label>
                <Select onValueChange={field.onChange} value={field.value || 'none'}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">Sin tipo</SelectItem>
                    <SelectItem value="Factura">Factura</SelectItem>
                    <SelectItem value="Boleta">Boleta</SelectItem>
                    <SelectItem value="Otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField name="document_number" control={form.control} render={({ field }) => (
              <FormItem>
                <Label className="text-foreground">Número de Documento *</Label>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value || ''}
                    placeholder="Ej: 243232"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        </ColoredSectionCard>
      )}

      {selectedSubcategoryRow?.requires_other_reason && (
        <ColoredSectionCard
          title="Motivo"
          icon={<Tag className="size-4" />}
          color="cyan"
          required
        >
          <FormField name="other_reason" control={form.control} render={({ field }) => (
            <FormItem>
              <Label className="text-foreground">Motivo *</Label>
              <Select onValueChange={field.onChange} value={field.value || ''}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar motivo" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {(Array.isArray((selectedSubcategoryRow as any).other_reasons)
                    ? ((selectedSubcategoryRow as any).other_reasons as any[]).map(v => String(v)).filter(Boolean)
                    : [
                        'Error de proveedor / documento pendiente',
                        'Gasto extraordinario no recurrente',
                        'Ajuste / regularización',
                        'Diferencia de caja / vuelto',
                        'Otro (justificar)'
                      ]
                  ).map((reason) => (
                    <SelectItem key={reason} value={reason}>
                      {reason}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
        </ColoredSectionCard>
      )}

      {/* Campos de Piezas y Repuestos */}
      {isPiezasYRepuestos && (
        <ColoredSectionCard
          title="Información de Piezas y Repuestos"
          icon={<Package className="size-4" />}
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
                  <Package className="size-4" />
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
                  <Phone className="size-4" />
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
                  <Hash className="size-4" />
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
                  <DollarSign className="size-4" />
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
                  <Gauge className="size-4" />
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
