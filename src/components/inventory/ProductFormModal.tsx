import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useInventoryCategories, useCreateInventoryItem, useUpdateInventoryItem, type InventoryItem } from '@/hooks/useInventory';
import { toast } from 'sonner';
import { isDuplicateError, extractDuplicateField, getDuplicateErrorMessage } from '@/utils/validationUtils';
import { useSimilarItemsSearch } from '@/utils/inventoryHelper';
import { SimilarProductAlert } from '@/components/cranes/forms/SimilarProductAlert';
import { ProductDetailsModal } from '@/components/inventory/ProductDetailsModal';

const productSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  description: z.string().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  category_id: z.string().optional(),
  unit_of_measure: z.string().min(1, 'La unidad de medida es requerida'),
  minimum_stock: z.number().min(0, 'Debe ser mayor o igual a 0'),
  maximum_stock: z.number().min(0, 'Debe ser mayor o igual a 0'),
  safety_stock: z.number().min(0, 'Debe ser mayor o igual a 0'),
  unit_cost: z.number().min(0, 'Debe ser mayor o igual a 0'),
  is_active: z.boolean().default(true),
  is_critical: z.boolean().default(false),
  has_expiration: z.boolean().default(false),
}).refine((data) => data.maximum_stock >= data.minimum_stock, {
  message: "El stock máximo debe ser mayor o igual al stock mínimo",
  path: ["maximum_stock"],
}).refine((data) => data.safety_stock <= data.maximum_stock, {
  message: "El stock de seguridad debe ser menor o igual al stock máximo",
  path: ["safety_stock"],
});

type ProductFormData = z.infer<typeof productSchema>;

interface ProductFormModalProps {
  product?: InventoryItem;
  onSuccess: () => void;
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({ product, onSuccess }) => {
  const { data: categories = [] } = useInventoryCategories();
  const createProduct = useCreateInventoryItem();
  const updateProduct = useUpdateInventoryItem();
  
  // Estados para el sistema de alertas de similitud
  const [confirmCreateNew, setConfirmCreateNew] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedSimilarProduct, setSelectedSimilarProduct] = useState(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name || '',
      description: product?.description || '',
      sku: product?.sku || '',
      barcode: product?.barcode || '',
      category_id: product?.category_id || '',
      unit_of_measure: product?.unit_of_measure || 'unidad',
      minimum_stock: product?.minimum_stock || 0,
      maximum_stock: product?.maximum_stock || 0,
      safety_stock: product?.safety_stock || 0,
      unit_cost: product?.unit_cost || 0,
      is_active: product?.is_active ?? true,
      is_critical: product?.is_critical ?? false,
      has_expiration: product?.has_expiration ?? false,
    },
  });

  const watchedValues = watch();
  
  // Hook para detectar productos similares (solo para productos nuevos)
  const { similarItems, shouldAlert, alertMessage, isLoading } = useSimilarItemsSearch(
    watchedValues.name || '', 
    !product // Solo buscar similitudes cuando no estamos editando
  );

  // Handlers para el sistema de alertas
  const handleUseExisting = (similarProduct) => {
    // Llenar el formulario con los datos del producto existente
    setValue('name', similarProduct.name);
    setValue('description', similarProduct.description || '');
    setValue('sku', similarProduct.sku || '');
    setValue('barcode', similarProduct.barcode || '');
    setValue('category_id', similarProduct.category_id || '');
    setValue('unit_of_measure', similarProduct.unit_of_measure);
    setValue('minimum_stock', similarProduct.minimum_stock || 0);
    setValue('maximum_stock', similarProduct.maximum_stock || 0);
    setValue('safety_stock', similarProduct.safety_stock || 0);
    setValue('unit_cost', similarProduct.unit_cost || 0);
    setValue('is_active', similarProduct.is_active);
    setValue('is_critical', similarProduct.is_critical);
    setValue('has_expiration', similarProduct.has_expiration);
    
    toast.success('Datos del producto existente cargados en el formulario');
  };

  const handleViewDetails = (similarProduct) => {
    setSelectedSimilarProduct(similarProduct);
    setDetailsModalOpen(true);
  };

  const handleCreateNew = () => {
    setConfirmCreateNew(true);
    toast.info('Confirmado: Se creará un nuevo producto');
  };

  const onSubmit = async (data: ProductFormData) => {
    // Si hay productos similares y no hemos confirmado, bloquear envío
    if (!product && shouldAlert && !confirmCreateNew) {
      toast.warning('Hay productos similares. Por favor, revisa las opciones antes de continuar.');
      return;
    }
    
    try {
      const productData = {
        name: data.name,
        description: data.description || null,
        sku: data.sku && data.sku.trim() !== '' ? data.sku.trim() : null,
        barcode: data.barcode && data.barcode.trim() !== '' ? data.barcode.trim() : null,
        category_id: data.category_id === 'none' ? null : data.category_id,
        unit_of_measure: data.unit_of_measure,
        minimum_stock: data.minimum_stock,
        maximum_stock: data.maximum_stock,
        safety_stock: data.safety_stock,
        unit_cost: data.unit_cost,
        is_active: data.is_active,
        is_critical: data.is_critical,
        has_expiration: data.has_expiration,
      };

      if (product) {
        // Update existing product
        await updateProduct.mutateAsync({ 
          id: product.id, 
          updates: productData 
        });
      } else {
        // Create new product
        await createProduct.mutateAsync(productData);
      }
      
      onSuccess();
    } catch (error) {
      console.error('Error saving product:', error);
      
      // Manejo específico de errores de duplicado
      if (isDuplicateError(error)) {
        const field = extractDuplicateField(error);
        if (field === 'sku') {
          toast.error(`Ya existe un producto con el SKU "${data.sku}"`);
        } else {
          toast.error(getDuplicateErrorMessage('producto', field || 'campo', ''));
        }
      } else {
        toast.error(`Error al ${product ? 'actualizar' : 'crear'} el producto`);
      }
    }
  };

  const unitOptions = [
    'unidad',
    'litro',
    'metro',
    'kilogramo',
    'caja',
    'par',
    'rollo',
    'galón',
    'saco',
    'tubo',
  ];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Basic Information */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Nombre del Producto *</Label>
            <Input
              id="name"
              {...register('name')}
            />
            {errors.name && (
              <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
            )}
          </div>

          {/* Alerta de productos similares - Solo para productos nuevos */}
          {!product && shouldAlert && (
            <SimilarProductAlert
              similarityResult={{
                exactMatch: similarItems.find(item => item.match_type === 'exact') || null,
                similarItems: similarItems,
                alertMessage: alertMessage,
                shouldAlert: shouldAlert
              }}
              onUseExisting={handleUseExisting}
              onCreateNew={handleCreateNew}
              onViewDetails={handleViewDetails}
            />
          )}

          <div>
            <Label htmlFor="sku">SKU</Label>
            <Input
              id="sku"
              {...register('sku')}
              placeholder="Código único del producto"
            />
            {errors.sku && (
              <p className="text-sm text-destructive mt-1">{errors.sku.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="barcode">Código de Barras</Label>
            <Input
              id="barcode"
              {...register('barcode')}
              placeholder="Código de barras del producto"
            />
            {errors.barcode && (
              <p className="text-sm text-destructive mt-1">{errors.barcode.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="category_id">Categoría</Label>
            <Select
              value={watchedValues.category_id}
              onValueChange={(value) => setValue('category_id', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin categoría</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="unit_of_measure">Unidad de Medida *</Label>
            <Select
              value={watchedValues.unit_of_measure}
              onValueChange={(value) => setValue('unit_of_measure', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {unitOptions.map((unit) => (
                  <SelectItem key={unit} value={unit}>
                    {unit}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.unit_of_measure && (
              <p className="text-sm text-destructive mt-1">{errors.unit_of_measure.message}</p>
            )}
          </div>
        </div>

        {/* Stock and Cost Information */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="minimum_stock">Stock Mínimo</Label>
            <Input
              id="minimum_stock"
              type="number"
              min="0"
              {...register('minimum_stock', { valueAsNumber: true })}
            />
            {errors.minimum_stock && (
              <p className="text-sm text-destructive mt-1">{errors.minimum_stock.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="maximum_stock">Stock Máximo</Label>
            <Input
              id="maximum_stock"
              type="number"
              min="0"
              {...register('maximum_stock', { valueAsNumber: true })}
            />
            {errors.maximum_stock && (
              <p className="text-sm text-destructive mt-1">{errors.maximum_stock.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="safety_stock">Stock de Seguridad</Label>
            <Input
              id="safety_stock"
              type="number"
              min="0"
              {...register('safety_stock', { valueAsNumber: true })}
            />
            {errors.safety_stock && (
              <p className="text-sm text-destructive mt-1">{errors.safety_stock.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="unit_cost">Costo Unitario ($)</Label>
            <Input
              id="unit_cost"
              type="number"
              min="0"
              step="0.01"
              {...register('unit_cost', { valueAsNumber: true })}
            />
            {errors.unit_cost && (
              <p className="text-sm text-destructive mt-1">{errors.unit_cost.message}</p>
            )}
          </div>

          {/* Switches */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">Producto Activo</Label>
              <Switch
                id="is_active"
                checked={watchedValues.is_active}
                onCheckedChange={(checked) => setValue('is_active', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="is_critical">Producto Crítico</Label>
              <Switch
                id="is_critical"
                checked={watchedValues.is_critical}
                onCheckedChange={(checked) => setValue('is_critical', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="has_expiration">Tiene Vencimiento</Label>
              <Switch
                id="has_expiration"
                checked={watchedValues.has_expiration}
                onCheckedChange={(checked) => setValue('has_expiration', checked)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      <div>
        <Label htmlFor="description">Descripción</Label>
        <Textarea
          id="description"
          {...register('description')}
          rows={3}
          placeholder="Descripción detallada del producto..."
        />
      </div>

      {/* Form Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onSuccess}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : product ? 'Actualizar' : 'Crear Producto'}
        </Button>
      </div>

      {/* Modal de detalles del producto */}
      <ProductDetailsModal
        isOpen={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        product={selectedSimilarProduct}
      />
    </form>
  );
};