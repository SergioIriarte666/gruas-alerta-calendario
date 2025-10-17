import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, AlertTriangle, Package, Plus, Minus } from 'lucide-react';
import { useInventoryItems, useInventoryStock, useInventoryCategories } from '@/hooks/useInventory';
import { ProductDrawer } from './ProductDrawer';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SimpleEntryForm } from './SimpleEntryForm';
import { SimpleExitForm } from './SimpleExitForm';

export const InventoryStockView = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [showExitForm, setShowExitForm] = useState(false);

  const { data: items = [], isLoading } = useInventoryItems();
  const { data: categories = [] } = useInventoryCategories();
  const { data: allStock = [] } = useInventoryStock();

  // Filter items
  const filteredItems = items.filter(item => {
    const matchesSearch = !searchTerm || 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || item.category_id === categoryFilter;
    
    return matchesSearch && matchesCategory && item.is_active;
  });

  // Get total stock for each item
  const getItemStock = (itemId: string) => {
    const itemStock = allStock.filter(s => s.item_id === itemId);
    return itemStock.reduce((sum, s) => sum + (s.available_quantity || 0), 0);
  };

  const getStockStatus = (item: any) => {
    const totalStock = getItemStock(item.id);
    
    if (totalStock === 0) {
      return { label: 'Sin Stock', variant: 'destructive' as const, icon: AlertTriangle };
    } else if (totalStock <= item.minimum_stock) {
      return { label: 'Stock Bajo', variant: 'secondary' as const, icon: AlertTriangle };
    } else {
      return { label: 'Normal', variant: 'default' as const, icon: Package };
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8 text-muted-foreground">
            Cargando inventario...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Stock de Productos
            </CardTitle>
            <div className="flex gap-2">
              <Dialog open={showEntryForm} onOpenChange={setShowEntryForm}>
                <Button 
                  size="sm" 
                  onClick={() => setShowEntryForm(true)}
                  className="gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Nueva Entrada
                </Button>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Registrar Entrada de Inventario</DialogTitle>
                  </DialogHeader>
                  <SimpleEntryForm onSuccess={() => setShowEntryForm(false)} />
                </DialogContent>
              </Dialog>

              <Dialog open={showExitForm} onOpenChange={setShowExitForm}>
                <Button 
                  size="sm" 
                  variant="destructive"
                  onClick={() => setShowExitForm(true)}
                  className="gap-2"
                >
                  <Minus className="w-4 h-4" />
                  Nueva Salida
                </Button>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Registrar Salida de Inventario</DialogTitle>
                  </DialogHeader>
                  <SimpleExitForm onSuccess={() => setShowExitForm(false)} />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar por nombre o SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Products List */}
          <div className="space-y-2">
            {filteredItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No se encontraron productos
              </div>
            ) : (
              filteredItems.map((item) => {
                const totalStock = getItemStock(item.id);
                const status = getStockStatus(item);
                const StatusIcon = status.icon;

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedProductId(item.id)}
                    className="flex items-center justify-between p-4 bg-muted/50 hover:bg-muted rounded-lg cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{item.name}</h4>
                          {item.is_critical && (
                            <Badge variant="destructive" className="text-xs">
                              Crítico
                            </Badge>
                          )}
                        </div>
                        {item.sku && (
                          <p className="text-sm text-muted-foreground">SKU: {item.sku}</p>
                        )}
                      </div>
                      
                      <div className="text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <StatusIcon className="w-4 h-4" />
                          <span className="text-2xl font-bold">{totalStock}</span>
                          <span className="text-sm text-muted-foreground">
                            {item.unit_of_measure}
                          </span>
                        </div>
                        <Badge variant={status.variant} className="text-xs mt-1">
                          {status.label}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="text-sm text-muted-foreground pt-2">
            Mostrando {filteredItems.length} de {items.filter(i => i.is_active).length} productos
          </div>
        </CardContent>
      </Card>

      {/* Product Drawer */}
      <ProductDrawer
        productId={selectedProductId}
        open={!!selectedProductId}
        onClose={() => setSelectedProductId(null)}
      />
    </>
  );
};
