import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Package } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface InventoryItem {
  id: string;
  name: string;
  unit_cost: number;
  current_stock: number;
  unit_of_measure: string;
}

interface ProductSaleItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  availableStock: number;
  unitOfMeasure: string;
}

interface ProductSalesSectionProps {
  salesItems: ProductSaleItem[];
  onSalesItemsChange: (items: ProductSaleItem[]) => void;
  disabled?: boolean;
}

export const ProductSalesSection = ({
  salesItems,
  onSalesItemsChange,
  disabled = false
}: ProductSalesSectionProps) => {
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [customPrice, setCustomPrice] = useState<number | null>(null);

  // Fetch available inventory items
  const { data: inventoryItems = [], isLoading } = useQuery({
    queryKey: ['inventory-items-for-sales'],
    queryFn: async (): Promise<InventoryItem[]> => {
      const { data, error } = await supabase
        .from('inventory_items')
        .select(`
          id,
          name,
          unit_cost,
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
          unit_cost: item.unit_cost || 0,
          unit_of_measure: item.unit_of_measure,
          current_stock: totalStock
        };
      });
    }
  });

  const selectedProduct = inventoryItems.find(item => item.id === selectedProductId);

  const addProduct = () => {
    if (!selectedProduct) {
      toast.error('Selecciona un producto');
      return;
    }

    if (selectedProduct.current_stock === 0) {
      toast.error('Este producto no tiene stock disponible');
      return;
    }

    if (quantity <= 0) {
      toast.error('La cantidad debe ser mayor a 0');
      return;
    }

    if (quantity > selectedProduct.current_stock) {
      toast.error(`Stock insuficiente. Disponible: ${selectedProduct.current_stock} ${selectedProduct.unit_of_measure}`);
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
      id: `sale-${Date.now()}`,
      productId: selectedProduct.id,
      productName: selectedProduct.name,
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
      toast.error(`Stock insuficiente. Disponible: ${item.availableStock} ${item.unitOfMeasure}`);
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

  // Auto-set custom price when product changes
  useEffect(() => {
    if (selectedProduct) {
      setCustomPrice(selectedProduct.unit_cost);
    }
  }, [selectedProduct]);

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
            <Select
              value={selectedProductId}
              onValueChange={setSelectedProductId}
              disabled={disabled || isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder={isLoading ? "Cargando..." : "Seleccionar producto"} />
              </SelectTrigger>
              <SelectContent>
                {inventoryItems.map((item) => (
                  <SelectItem 
                    key={item.id} 
                    value={item.id}
                    disabled={item.current_stock === 0}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className={item.current_stock === 0 ? "text-muted-foreground" : ""}>
                        {item.name}
                      </span>
                      <Badge 
                        variant={item.current_stock === 0 ? "destructive" : "secondary"}
                        className="ml-2"
                      >
                        {item.current_stock === 0 
                          ? "Sin stock" 
                          : `${item.current_stock} ${item.unit_of_measure}`
                        }
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
                {inventoryItems.length === 0 && !isLoading && (
                  <SelectItem value="" disabled>
                    No hay productos disponibles
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Cantidad</Label>
            <Input
              type="number"
              min="1"
              max={selectedProduct?.current_stock || 999}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              disabled={disabled}
            />
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
            />
          </div>

          <div className="flex items-end">
            <Button
              onClick={addProduct}
              disabled={
                disabled || 
                !selectedProductId || 
                (selectedProduct && selectedProduct.current_stock === 0)
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