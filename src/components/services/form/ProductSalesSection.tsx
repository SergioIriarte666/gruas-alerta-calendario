import React, { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Package } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ProductCombobox, type ProductComboboxItem } from '@/components/inventory/ProductCombobox';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { getSalePrice } from '@/utils/inventoryPricing';
import { createLogger } from '@/lib/logger';
import { cn } from '@/lib/utils';

const logger = createLogger('ProductSalesSection');

interface InventoryItem extends ProductComboboxItem {
  unit_cost: number;
  sale_markup_percent?: number | null;
  sale_price_fixed?: number | null;
}

interface ProductSaleItem {
  id: string;
  productId: string;
  productName: string;
  sku?: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  availableStock: number;
  unitOfMeasure: string;
}

/** Ítem de service_items ya persistido, para reconstruir salesItems al editar. */
export interface InitialSaleItem {
  id: string;
  inventoryItemId: string | null;
  cantidad: number;
  valorUnitario: number;
}

interface ProductSalesSectionProps {
  salesItems: ProductSaleItem[];
  onSalesItemsChange: (items: ProductSaleItem[]) => void;
  disabled?: boolean;
  /** service_items existentes al editar un servicio; se usan una sola vez para hidratar salesItems. */
  initialItems?: InitialSaleItem[];
}

const buildQuantitySchema = (maxStock: number) =>
  z.number({ invalid_type_error: 'La cantidad debe ser un número' })
    .min(1, 'La cantidad debe ser mayor a 0')
    .max(maxStock, `Stock disponible: ${maxStock}`);

export const ProductSalesSection = ({
  salesItems,
  onSalesItemsChange,
  disabled = false,
  initialItems
}: ProductSalesSectionProps) => {
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [customPrice, setCustomPrice] = useState<number | null>(null);
  const [quantityError, setQuantityError] = useState<string | null>(null);
  const { systemSettings } = useSystemSettings();
  const hydratedRef = useRef(false);

  // Fetch available inventory items
  const { data: inventoryItems = [], isLoading } = useQuery({
    queryKey: ['inventory-items-for-sales'],
    queryFn: async (): Promise<InventoryItem[]> => {
      const { data, error } = await supabase
        .from('inventory_items')
        .select(`
          id,
          name,
          sku,
          unit_cost,
          sale_markup_percent,
          sale_price_fixed,
          unit_of_measure,
          inventory_stock(current_quantity)
        `)
        .eq('is_active', true);

      if (error) throw error;

      return data.map(item => {
        // Sum stock from all locations for this item
        const totalStock = item.inventory_stock?.reduce(
          (sum: number, stock: any) => sum + (stock.current_quantity || 0),
          0
        ) || 0;

        return {
          id: item.id,
          name: item.name,
          sku: item.sku,
          unit_cost: item.unit_cost || 0,
          sale_markup_percent: item.sale_markup_percent,
          sale_price_fixed: item.sale_price_fixed,
          unit_of_measure: item.unit_of_measure,
          current_stock: totalStock
        };
      });
    }
  });

  const selectedProduct = inventoryItems.find(item => item.id === selectedProductId);

  // Al editar un servicio existente: reconstruir salesItems desde los
  // service_items ya persistidos (vía inventory_item_id), una sola vez y
  // solo si el llamador no trae ya productos cargados.
  useEffect(() => {
    if (hydratedRef.current) return;
    if (isLoading) return;
    if (!initialItems || initialItems.length === 0) {
      hydratedRef.current = true;
      return;
    }
    if (salesItems.length > 0) {
      hydratedRef.current = true;
      return;
    }

    const hydrated: ProductSaleItem[] = initialItems
      .filter((item) => !!item.inventoryItemId)
      .map((item) => {
        const product = inventoryItems.find((p) => p.id === item.inventoryItemId);
        return {
          id: item.id,
          productId: item.inventoryItemId as string,
          productName: product?.name ?? '(producto eliminado)',
          sku: product?.sku ?? null,
          quantity: item.cantidad,
          unitPrice: item.valorUnitario,
          totalPrice: item.cantidad * item.valorUnitario,
          availableStock: product?.current_stock ?? 0,
          unitOfMeasure: product?.unit_of_measure ?? 'unidad',
        };
      });

    if (hydrated.length > 0) {
      onSalesItemsChange(hydrated);
    }
    hydratedRef.current = true;
  }, [initialItems, isLoading, inventoryItems, salesItems.length, onSalesItemsChange]);

  const validateQuantity = (value: number, maxStock: number): boolean => {
    const result = buildQuantitySchema(maxStock).safeParse(value);
    setQuantityError(result.success ? null : result.error.issues[0].message);
    return result.success;
  };

  const addProduct = () => {
    if (!selectedProduct) {
      toast.error('Selecciona un producto');
      return;
    }

    if (selectedProduct.current_stock === 0) {
      toast.error('Este producto no tiene stock disponible');
      return;
    }

    if (!validateQuantity(quantity, selectedProduct.current_stock)) {
      return;
    }

    // Check if product is already added
    const existingItem = salesItems.find(item => item.productId === selectedProductId);
    if (existingItem) {
      toast.error('Este producto ya está agregado a la venta');
      return;
    }

    const unitPrice = customPrice !== null ? customPrice : selectedProduct.unit_cost;
    const totalPrice = quantity * unitPrice;

    const newItem: ProductSaleItem = {
      id: crypto.randomUUID(),
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      sku: selectedProduct.sku ?? null,
      quantity,
      unitPrice,
      totalPrice,
      availableStock: selectedProduct.current_stock,
      unitOfMeasure: selectedProduct.unit_of_measure
    };

    onSalesItemsChange([...salesItems, newItem]);

    // Reset form
    setSelectedProductId('');
    setQuantity(1);
    setCustomPrice(null);
    setQuantityError(null);
    toast.success('Producto agregado a la venta');
  };

  const removeProduct = (itemId: string) => {
    onSalesItemsChange(salesItems.filter(item => item.id !== itemId));
    toast.success('Producto eliminado de la venta');
  };

  const updateQuantity = (itemId: string, newQuantity: number) => {
    const item = salesItems.find(s => s.id === itemId);
    if (!item) return;

    if (newQuantity > item.availableStock) {
      toast.error(`Stock disponible: ${item.availableStock}`);
      return;
    }

    onSalesItemsChange(
      salesItems.map(s =>
        s.id === itemId
          ? { ...s, quantity: newQuantity, totalPrice: newQuantity * s.unitPrice }
          : s
      )
    );
  };

  const updatePrice = (itemId: string, newPrice: number) => {
    onSalesItemsChange(
      salesItems.map(s =>
        s.id === itemId
          ? { ...s, unitPrice: newPrice, totalPrice: s.quantity * newPrice }
          : s
      )
    );
  };

  const getTotalSale = () => {
    return salesItems.reduce((total, item) => total + item.totalPrice, 0);
  };

  // Al elegir un producto: autocompletar el precio con el último precio de
  // venta usado para ese producto (inventory_movements.sale_unit_price de la
  // salida vinculada a un servicio más reciente). Si no hay historial, se usa
  // el precio de venta configurado del producto (fijo, % propio o margen por
  // defecto global) como referencia editable — nunca el costo puro.
  useEffect(() => {
    if (!selectedProduct) {
      setCustomPrice(null);
      return;
    }

    let cancelled = false;
    setCustomPrice(getSalePrice(selectedProduct, systemSettings.defaultSaleMarkupPercent).price);

    supabase
      .from('inventory_movements')
      .select('sale_unit_price')
      .eq('item_id', selectedProduct.id)
      .eq('movement_type', 'exit')
      .not('sale_unit_price', 'is', null)
      .order('movement_date', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          logger.error('Error buscando último precio de venta:', error);
          return;
        }
        if (data?.sale_unit_price != null) {
          setCustomPrice(Number(data.sale_unit_price));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedProduct, systemSettings.defaultSaleMarkupPercent]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="size-5" />
          Productos a Vender
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add Product Form */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>Producto</Label>
            <ProductCombobox
              products={inventoryItems}
              value={selectedProductId}
              onChange={(id) => {
                setSelectedProductId(id);
                const product = inventoryItems.find(item => item.id === id);
                if (product) validateQuantity(quantity, product.current_stock);
              }}
              disabled={disabled || isLoading}
              placeholder={isLoading ? 'Cargando...' : 'Seleccionar producto'}
            />
          </div>

          <div className="space-y-2">
            <Label>Cantidad</Label>
            <Input
              type="number"
              min="1"
              max={selectedProduct?.current_stock || 999}
              value={quantity}
              onChange={(e) => {
                const newQuantity = Math.max(1, parseInt(e.target.value) || 1);
                setQuantity(newQuantity);
                if (selectedProduct) validateQuantity(newQuantity, selectedProduct.current_stock);
              }}
              disabled={disabled}
            />
            {quantityError && (
              <p className="text-sm text-destructive">{quantityError}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Precio Unitario ($)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={customPrice || ''}
              onChange={(e) => setCustomPrice(parseFloat(e.target.value) || 0)}
              placeholder={selectedProduct ? selectedProduct.unit_cost.toString() : '0'}
              disabled={disabled}
              className={cn(
                selectedProduct && (customPrice ?? 0) < selectedProduct.unit_cost && 'border-amber-500 focus-visible:ring-amber-500'
              )}
            />
            {selectedProduct && (customPrice ?? 0) < selectedProduct.unit_cost && (
              <p className="text-xs text-amber-600">
                Bajo el costo: ${selectedProduct.unit_cost.toLocaleString('es-CL')}
              </p>
            )}
            {selectedProduct && (
              <p className="text-xs text-muted-foreground">
                Costo: ${selectedProduct.unit_cost.toLocaleString('es-CL')}
                {' · '}
                Margen: {selectedProduct.unit_cost > 0
                  ? Math.round(((customPrice ?? 0) - selectedProduct.unit_cost) / selectedProduct.unit_cost * 100)
                  : 0}%
              </p>
            )}
          </div>

          <div className="flex items-end">
            <Button
              onClick={addProduct}
              disabled={
                disabled ||
                !selectedProductId ||
                (selectedProduct && selectedProduct.current_stock === 0) ||
                !!quantityError
              }
              className="w-full"
            >
              <Plus className="size-4 mr-2" />
              Agregar
            </Button>
          </div>
        </div>

        {/* Sales Items List */}
        {salesItems.length > 0 && (
          <div className="space-y-4">
            <div className="border rounded-lg">
              <div className="grid grid-cols-6 gap-4 p-4 bg-muted font-medium text-sm">
                <div>Producto</div>
                <div>Cantidad</div>
                <div>Precio Unit.</div>
                <div>Total</div>
                <div>Stock Disp.</div>
                <div>Acciones</div>
              </div>

              {salesItems.map((item) => (
                <div key={item.id} className="grid grid-cols-6 gap-4 p-4 border-t">
                  <div className="flex flex-col">
                    <span className="font-medium">{item.productName}</span>
                    <Badge variant="outline" className="w-fit text-xs">
                      {item.unitOfMeasure}
                    </Badge>
                  </div>

                  <div>
                    <Input
                      type="number"
                      min="1"
                      max={item.availableStock}
                      value={item.quantity}
                      onChange={(e) => updateQuantity(item.id, Math.max(1, parseInt(e.target.value) || 1))}
                      disabled={disabled}
                      className="w-20"
                    />
                  </div>

                  <div>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(e) => updatePrice(item.id, parseFloat(e.target.value) || 0)}
                      disabled={disabled}
                      className="w-24"
                    />
                  </div>

                  <div className="font-medium">
                    ${item.totalPrice.toLocaleString()}
                  </div>

                  <div className="text-sm text-muted-foreground">
                    {item.availableStock} {item.unitOfMeasure}
                  </div>

                  <div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeProduct(item.id)}
                      disabled={disabled}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="flex justify-end">
              <div className="bg-primary/10 p-4 rounded-lg border border-primary/20">
                <div className="flex items-center gap-4">
                  <span className="text-lg font-medium">Total de la Venta:</span>
                  <span className="text-2xl font-bold text-primary">
                    ${getTotalSale().toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {salesItems.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="size-12 mx-auto mb-4 opacity-50" />
            <p>No hay productos agregados a la venta</p>
            <p className="text-sm">Selecciona productos del inventario para comenzar</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
