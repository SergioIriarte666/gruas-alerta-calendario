import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, AlertTriangle, Package, Plus, Minus } from 'lucide-react';
import { useInventoryItems, useInventoryStock, useInventoryCategories, useInventoryLocations, useCreateInventoryMovement } from '@/hooks/useInventory';
import { ProductDrawer } from './ProductDrawer';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SimpleEntryForm } from './SimpleEntryForm';
import { SimpleExitForm } from './SimpleExitForm';
import { ProductFormModal } from './ProductFormModal';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export const InventoryStockView = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [showExitForm, setShowExitForm] = useState(false);
  const [showCreateProductForm, setShowCreateProductForm] = useState(false);
  const [showEditProductForm, setShowEditProductForm] = useState(false);
  const [editProductId, setEditProductId] = useState<string | null>(null);
  const [showZeroStock, setShowZeroStock] = useState(false);
  const [showCleanup, setShowCleanup] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [orphans, setOrphans] = useState<Array<{ id: string; name: string; stock: number }>>([]);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');

  const { data: items = [], isLoading } = useInventoryItems();
  const { data: categories = [] } = useInventoryCategories();
  const { data: allStock = [] } = useInventoryStock();
  const queryClient = useQueryClient();
  const { data: locations = [] } = useInventoryLocations();
  const createMovement = useCreateInventoryMovement();

  const [quickItemId, setQuickItemId] = useState<string>('');
  const [quickLocationId, setQuickLocationId] = useState<string>('');
  const [quickType, setQuickType] = useState<'entry' | 'exit'>('entry');
  const [quickQty, setQuickQty] = useState<number>(1);
  const [quickUnitCost, setQuickUnitCost] = useState<number>(0);
  const [quickGenerateCost, setQuickGenerateCost] = useState<boolean>(false);

  React.useEffect(() => {
    if (!quickLocationId && locations.length > 0) {
      setQuickLocationId(locations[0].id);
    }
  }, [locations, quickLocationId]);

  const getItemStock = (itemId: string) => {
    const itemStock = allStock.filter(s => s.item_id === itemId);
    return itemStock.reduce((sum, s) => sum + (s.available_quantity || 0), 0);
  };

  async function scanOrphans() {
    try {
      setIsScanning(true);
      const candidates = items.filter(i => i.is_active).map(i => ({ id: i.id, name: i.name, stock: getItemStock(i.id) }));
      const zeroStock = candidates.filter(c => c.stock === 0);
      const counts = await getActiveMovementCounts(zeroStock.map(z => z.id));
      const list = zeroStock.filter(z => (counts[z.id] || 0) === 0);
      setOrphans(list);
    } catch {
      toast.error('No se pudo escanear ítems huérfanos');
    } finally {
      setIsScanning(false);
    }
  }

  async function deactivateOrphans() {
    try {
      setIsCleaning(true);
      const ids = orphans.map(o => o.id);
      if (ids.length === 0) return;
      const { error } = await supabase.from('inventory_items').update({ is_active: false }).in('id', ids);
      if (error) throw error;
      toast.success(`Marcados inactivos: ${ids.length}`);
      setOrphans([]);
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stock'] });
    } catch {
      toast.error('No se pudo actualizar el estado');
    } finally {
      setIsCleaning(false);
    }
  }

  async function deleteOrphans() {
    try {
      setIsCleaning(true);
      const ids = orphans.map(o => o.id);
      if (ids.length === 0) return;
      const { error } = await supabase.from('inventory_items').delete().in('id', ids);
      if (error) throw error;
      toast.success(`Eliminados: ${ids.length}`);
      setOrphans([]);
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stock'] });
    } catch {
      toast.error('No se pudo eliminar');
    } finally {
      setIsCleaning(false);
    }
  }

  async function handleDeleteItem(itemId: string, itemName: string) {
    const stock = getItemStock(itemId);
    if (!window.confirm(`Eliminar definitivamente "${itemName}"?`)) return;
    try {
      const { data: movements } = await supabase
        .from('inventory_movements')
        .select('id')
        .eq('item_id', itemId)
        .eq('status', 'active')
        .limit(1);
      const hasActive = (movements || []).length > 0;
      if (stock > 0 || hasActive) {
        const proceed = window.confirm('El ítem tiene stock o movimientos activos.\n¿Vaciar stock, eliminar movimientos y borrar el ítem de todas formas?');
        if (!proceed) {
          toast.error('No se puede eliminar: tiene stock o movimientos activos');
          return;
        }
        await forceDeleteItem(itemId);
        toast.success('Registro forzado eliminado');
        queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
        queryClient.invalidateQueries({ queryKey: ['inventory-stock'] });
        return;
      }
      await supabase.from('inventory_stock').delete().eq('item_id', itemId);
      const { error } = await supabase.from('inventory_items').delete().eq('id', itemId);
      if (error) throw error;
      toast.success('Registro eliminado');
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stock'] });
    } catch {
      toast.error('Error eliminando el registro');
    }
  }

  // Filter items
  const filteredItems = items.filter(item => {
    const matchesSearch = !searchTerm || 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || item.category_id === categoryFilter;
    
    return matchesSearch && matchesCategory && item.is_active;
  });

  const getStockStatus = (item: any) => {
    const totalStock = getItemStock(item.id);
    
    if (totalStock === 0) {
      return { label: 'Sin Stock', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200', icon: AlertTriangle };
    } else if (totalStock <= item.minimum_stock) {
      return { label: 'Stock Bajo', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200', icon: AlertTriangle };
    } else {
      return { label: 'Normal', className: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 border-violet-200', icon: Package };
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
              <Dialog open={showCreateProductForm} onOpenChange={setShowCreateProductForm}>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowCreateProductForm(true)}
                  className="gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Nuevo Producto
                </Button>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Agregar Nuevo Producto</DialogTitle>
                  </DialogHeader>
                  <ProductFormModal onSuccess={() => setShowCreateProductForm(false)} onClose={() => setShowCreateProductForm(false)} />
                </DialogContent>
              </Dialog>

              <Dialog open={showEntryForm} onOpenChange={setShowEntryForm}>
                <Button 
                  size="sm" 
                  onClick={() => setShowEntryForm(true)}
                  className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
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
          {/* Quick Movement Panel */}
          <div className="p-3 border rounded-md bg-muted/30 space-y-3 border-l-4 border-l-violet-500">
            <div className="text-sm font-medium">Movimiento rápido</div>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
              <div className="md:col-span-2">
                <Select value={quickItemId} onValueChange={setQuickItemId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar producto" />
                  </SelectTrigger>
                  <SelectContent>
                    {items.filter(i => i.is_active).map(i => (
                      <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Select value={quickType} onValueChange={(v:any) => setQuickType(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entry">Entrada</SelectItem>
                    <SelectItem value="exit">Salida</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Select value={quickLocationId} onValueChange={setQuickLocationId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Ubicación" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Input type="number" min={1} value={quickQty} onChange={e => setQuickQty(parseInt(e.target.value || '1', 10))} placeholder="Cantidad" />
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  value={quickUnitCost}
                  onChange={e => setQuickUnitCost(parseFloat(e.target.value || '0'))}
                  placeholder="Costo unit."
                  disabled={quickType !== 'entry'}
                />
                <label className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={quickGenerateCost}
                    onChange={e => setQuickGenerateCost(e.target.checked)}
                    disabled={quickType !== 'entry'}
                  />
                  Generar costo
                </label>
              </div>
              <div className="text-right">
                <Button
                  onClick={() => {
                    if (!quickItemId || !quickLocationId || quickQty <= 0) {
                      toast.error('Completa producto, ubicación y cantidad');
                      return;
                    }
                    const movementDate = new Date().toISOString();
                    createMovement.mutate({
                      item_id: quickItemId,
                      location_id: quickLocationId,
                      movement_type: quickType,
                      quantity: quickQty,
                      unit_cost: quickType === 'entry' ? quickUnitCost : 0,
                      total_cost: quickType === 'entry' ? quickQty * quickUnitCost : 0,
                      movement_date: movementDate,
                      reason: quickType === 'entry' ? 'Entrada rápida' : 'Salida rápida',
                      observations: null,
                      crane_id: null,
                      supplier_id: null,
                      supplier_name: null,
                      reference_document: null,
                      status: 'active',
                      generateCost: quickType === 'entry' ? quickGenerateCost : false,
                    } as any);
                  }}
                >
                  Registrar
                </Button>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar por nombre o SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 focus-visible:ring-violet-500"
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
            <Button 
              variant={showZeroStock ? 'default' : 'outline'} 
              onClick={() => setShowZeroStock(v => !v)}
              className={cn(
                "whitespace-nowrap",
                showZeroStock && "bg-violet-600 hover:bg-violet-700 text-white"
              )}
            >
              {showZeroStock ? 'Mostrar todo' : 'Ocultar sin stock'}
            </Button>
            <Button 
              variant="outline"
              onClick={() => setViewMode(v => (v === 'table' ? 'cards' : 'table'))}
              className={cn(
                "whitespace-nowrap",
                viewMode === 'cards' && "bg-violet-600 hover:bg-violet-700 text-white border-violet-600"
              )}
            >
              {viewMode === 'table' ? 'Vista Tarjetas' : 'Vista Tabla'}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowCleanup(true);
                scanOrphans();
              }}
              className="whitespace-nowrap"
            >
              Limpiar huérfanos
            </Button>
          </div>

          {/* Products List */}
          {(() => {
            const rows = filteredItems.filter(i => showZeroStock ? true : getItemStock(i.id) > 0);
            if (rows.length === 0) {
              return <div className="text-center py-8 text-muted-foreground">No se encontraron productos</div>;
            }
            if (viewMode === 'table') {
              return (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3">Producto</th>
                        <th className="text-left py-2 px-3">SKU</th>
                        <th className="text-right py-2 px-3">Stock</th>
                        <th className="text-left py-2 px-3">Estado</th>
                        <th className="text-right py-2 px-3">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(item => {
                        const totalStock = getItemStock(item.id);
                        const status = getStockStatus(item);
                        const StatusIcon = status.icon;
                        return (
                          <tr key={item.id} className="border-b hover:bg-muted/50">
                            <td className="py-2 px-3">{item.name}</td>
                            <td className="py-2 px-3">{item.sku || '-'}</td>
                            <td className="py-2 px-3 text-right">{totalStock} {item.unit_of_measure}</td>
                            <td className="py-2 px-3">
                              <div className="flex items-center gap-2">
                                <StatusIcon className="w-4 h-4" />
                                <Badge variant="outline" className={cn("text-2xs font-semibold", status.className)}>{status.label}</Badge>
                              </div>
                            </td>
                            <td className="py-2 px-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button size="sm" onClick={() => setSelectedProductId(item.id)}>Ver</Button>
                                <Button size="sm" onClick={() => { setEditProductId(item.id); setShowEditProductForm(true); }} variant="outline">Editar</Button>
                                <Button size="sm" onClick={() => { setShowExitForm(true); setSelectedProductId(item.id); }} variant="secondary">Salida</Button>
                                <Button size="sm" onClick={() => { setShowEntryForm(true); setSelectedProductId(item.id); }} variant="secondary">Entrada</Button>
                                <Button size="sm" variant="destructive" onClick={() => handleDeleteItem(item.id, item.name)}>Eliminar</Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            }
            return (
              <div className="space-y-2">
                {rows.map((item) => {
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
                          <Badge variant="outline" className={cn("text-xs mt-1 font-semibold", status.className)}>
                            {status.label}
                          </Badge>
                          <div className="mt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditProductId(item.id);
                                setShowEditProductForm(true);
                              }}
                            >
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteItem(item.id, item.name);
                              }}
                            >
                              Eliminar
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2">
            Mostrando 
            <Badge variant="outline" className="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 font-semibold">
              {filteredItems.filter(i => showZeroStock ? true : getItemStock(i.id) > 0).length}
            </Badge>
            de {items.filter(i => i.is_active).length} productos
          </div>
        </CardContent>
      </Card>

      {/* Product Drawer */}
      <ProductDrawer
        productId={selectedProductId}
        open={!!selectedProductId}
        onClose={() => setSelectedProductId(null)}
      />
      <Dialog open={showEditProductForm} onOpenChange={setShowEditProductForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Producto</DialogTitle>
          </DialogHeader>
          {editProductId && (
            <ProductFormModal
              product={items.find(i => i.id === editProductId)}
              onSuccess={() => setShowEditProductForm(false)}
              onClose={() => setShowEditProductForm(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showCleanup} onOpenChange={setShowCleanup}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Limpiar ítems huérfanos</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Ítems sin stock, sin movimientos activos y potencialmente residuales. Puedes marcarlos como inactivos o eliminarlos.
            </p>
            <div className="border rounded-md max-h-60 overflow-auto">
              {isScanning ? (
                <div className="p-4 text-sm text-muted-foreground">Buscando ítems...</div>
              ) : orphans.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">No se detectaron ítems huérfanos.</div>
              ) : (
                <ul className="divide-y">
                  {orphans.map(o => (
                    <li key={o.id} className="p-3 flex items-center justify-between">
                      <span className="text-sm">{o.name}</span>
                      <Badge variant="secondary">Stock: {o.stock}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex justify-between">
              <Button variant="secondary" onClick={scanOrphans} disabled={isScanning || isCleaning}>
                Reescanear
              </Button>
              <div className="space-x-2">
                <Button 
                  variant="outline" 
                  onClick={deactivateOrphans} 
                  disabled={isScanning || isCleaning || orphans.length === 0}
                >
                  Marcar inactivos
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={deleteOrphans} 
                  disabled={isScanning || isCleaning || orphans.length === 0}
                >
                  Eliminar definitivamente
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

async function getActiveMovementCounts(itemIds: string[]) {
  if (itemIds.length === 0) return {};
  const { data } = await supabase
    .from('inventory_movements')
    .select('item_id')
    .in('item_id', itemIds)
    .eq('status', 'active');
  const counts: Record<string, number> = {};
  (data || []).forEach((m: any) => {
    const id = m.item_id as string;
    counts[id] = (counts[id] || 0) + 1;
  });
  return counts;
}

async function forceDeleteItem(itemId: string) {
  // Delete movements first to avoid FK constraints
  await supabase.from('inventory_movements').delete().eq('item_id', itemId);
  // Clean stock rows
  await supabase.from('inventory_stock').delete().eq('item_id', itemId);
  // Finally delete item
  await supabase.from('inventory_items').delete().eq('id', itemId);
}
