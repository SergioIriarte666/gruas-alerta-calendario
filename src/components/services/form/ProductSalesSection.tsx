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
import { sumAvailableStock } from '@/utils/availableStock';
import { createLogger } from '@/lib/logger';
import { inventoryQueryKeys } from '@/lib/queryKeys/inventory';
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
  /**
   * true mientras el llamador todavía está trayendo `initialItems` desde la BD.
   * Sin esto, un `initialItems` vacío por carga en curso se confunde con "el
   * servicio no tiene ítems" y la hidratación se bloquea para siempre (bug SRV-6822).
   */
  initialItemsLoading?: boolean;
}

const buildQuantitySchema = (maxStock: number) =>
  z.number({ invalid_type_error: 'La cantidad debe ser un número' })
    .min(1, 'La cantidad debe ser mayor a 0')
    .max(maxStock, `Stock disponible en bodega: ${maxStock}`);

export const ProductSalesSection = ({
  salesItems,
  onSalesItemsChange,
  disabled = false,
  initialItems,
  initialItemsLoading = false,
}: ProductSalesSectionProps) => {
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [customPrice, setCustomPrice] = useState<number | null>(null);
  const [quantityError, setQuantityError] = useState<string | null>(null);
  const { systemSettings } = useSystemSettings();
  const hydratedRef = useRef(false);
  const quantityToastShownRef = useRef(false);

  // Productos vendibles con su stock disponible.
  //
  // Fuente de verdad única: `inventory_stock` (la misma tabla que pinta Bodega),
  // sumando `available_quantity` cuando el producto existe en más de una
  // ubicación. Nunca se recalcula stock agregando `inventory_movements` en el
  // cliente: eso contaba también los movimientos anulados y el selector
  // mostraba un número distinto al de Bodega.
  //
  // `staleTime: 0` + `refetchOnMount: 'always'`: abrir el formulario siempre
  // trae stock fresco. La llave la comparten los managers de Bodega vía
  // `invalidateStockDependentQueries`, así que también se actualiza en vivo.
  const { data: inventoryItems = [], isLoading } = useQuery({
    queryKey: inventoryQueryKeys.salesSelector,
    staleTime: 0,
    refetchOnMount: 'always',
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
          inventory_stock(current_quantity, reserved_quantity, available_quantity)
        `)
        .eq('is_active', true);

      if (error) throw error;

      return data.map(item => {
        const totalStock = sumAvailableStock(item.inventory_stock);

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
    // Mientras `initialItems` todavía se está trayendo desde la BD, un array
    // vacío no significa "sin ítems" — esperar antes de fijar hydratedRef,
    // o un service_items real que llega después nunca se hidrata.
    if (initialItemsLoading) return;
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
  }, [initialItems, isLoading, initialItemsLoading, inventoryItems, salesItems.length, onSalesItemsChange]);

  /**
   * `notify`: además del error en línea, avisa con toast. El toast se emite una
   * sola vez por episodio de desborde (tipear "12" no debe disparar uno por
   * tecla); se rearma cuando la cantidad vuelve a ser válida o cambia el
   * producto.
   */
  const validateQuantity = (value: number, maxStock: number, notify = false): boolean => {
    const result = buildQuantitySchema(maxStock).safeParse(value);

    if (result.success) {
      setQuantityError(null);
      quantityToastShownRef.current = false;
      return true;
    }

    const message = result.error.issues[0].message;
    setQuantityError(message);
    if (notify && !quantityToastShownRef.current) {
      toast.error(message);
      quantityToastShownRef.current = true;
    }
    return false;
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

    if (!validateQuantity(quantity, selectedProduct.current_stock, true)) {
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

  /**
   * Stock vigente del producto según la última lectura de `inventory_stock`.
   * `availableStock` de la línea es un valor congelado al momento de agregarla;
   * para validar y para mostrar manda siempre el número vivo.
   */
  const liveStockFor = (productId: string, fallback: number): number =>
    inventoryItems.find(p => p.id === productId)?.current_stock ?? fallback;

  const updateQuantity = (itemId: string, newQuantity: number) => {
    const item = salesItems.find(s => s.id === itemId);
    if (!item) return;

    const availableStock = liveStockFor(item.productId, item.availableStock);
    if (newQuantity > availableStock) {
      toast.error(`Stock disponible en bodega: ${availableStock}`);
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
                quantityToastShownRef.current = false;
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
                if (selectedProduct) validateQuantity(newQuantity, selectedProduct.current_stock, true);
              }}
              disabled={disabled}
            />
            {quantityError ? (
              <p className="text-sm text-destructive">{quantityError}</p>
            ) : selectedProduct ? (
              <p className="text-xs text-muted-foreground">
                Disponible: {selectedProduct.current_stock} {selectedProduct.unit_of_measure}
              </p>
            ) : null}
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
                selectedProduct && (customPrice ?? 0) < selectedProduct.unit_cost && 'border-warning focus-visible:ring-warning'
              )}
            />
            {selectedProduct && (customPrice ?? 0) < selectedProduct.unit_cost && (
              <p className="text-xs text-warning-text">
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
                      max={liveStockFor(item.productId, item.availableStock)}
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
                    {liveStockFor(item.productId, item.availableStock)} {item.unitOfMeasure}
                  </div>

                  <div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeProduct(item.id)}
                      disabled={disabled}
                      className="text-danger-text hover:text-danger-text/80"
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
