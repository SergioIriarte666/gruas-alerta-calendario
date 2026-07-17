import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Search, AlertTriangle, Package, Plus, Minus, Loader2, Sparkles, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useInventoryItems,
  useInventoryStock,
  useInventoryCategories,
  useInventoryLocations,
  useCreateInventoryMovement,
} from '@/hooks/useInventory';
import {
  INVENTORY_LOCATION_ENTITY_LABELS,
  getLocationEntity,
  sortLocationsForEntity,
  type InventoryEntityFilter,
} from '@/utils/inventoryEntity';
import { ProductDrawer } from './ProductDrawer';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SimpleEntryForm } from './SimpleEntryForm';
import { SimpleExitForm } from './SimpleExitForm';
import { businessClock } from '@/utils/businessClock';
import { ProductFormModal } from './ProductFormModal';
import { DuplicateProductsPanel } from './DuplicateProductsPanel';
import { toast } from 'sonner';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { getSalePrice, describeSalePriceSource } from '@/utils/inventoryPricing';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  useInventoryOrphans,
  useInventoryItemHardDelete,
  type DeleteCandidateInfo,
} from '@/hooks/useInventoryOrphans';

interface InventoryStockViewProps {
  entityFilter?: InventoryEntityFilter;
}

export const InventoryStockView: React.FC<InventoryStockViewProps> = ({ entityFilter = 'all' }) => {
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
  const [showDuplicateMerge, setShowDuplicateMerge] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<DeleteCandidateInfo | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');

  const { data: items = [], isLoading } = useInventoryItems();
  const { data: categories = [] } = useInventoryCategories();
  const { data: allStock = [] } = useInventoryStock(entityFilter);
  const { isAdmin } = useUserPermissions();
  const { systemSettings } = useSystemSettings();
  const isMobile = useIsMobile();
  const { data: locations = [] } = useInventoryLocations();
  const createMovement = useCreateInventoryMovement();

  const [quickItemId, setQuickItemId] = useState<string>('');
  const [quickLocationId, setQuickLocationId] = useState<string>('');
  const [quickType, setQuickType] = useState<'entry' | 'exit'>('entry');
  const [quickQty, setQuickQty] = useState<number>(1);
  const [quickUnitCost, setQuickUnitCost] = useState<number>(0);
  const [quickGenerateCost, setQuickGenerateCost] = useState<boolean>(false);

  const orderedLocations = React.useMemo(
    () => sortLocationsForEntity(locations.filter((location) => location.is_active), entityFilter),
    [locations, entityFilter],
  );

  React.useEffect(() => {
    if (entityFilter !== 'all') {
      const preferredLocation = orderedLocations.find((location) => getLocationEntity(location) === entityFilter);
      if (preferredLocation && (!quickLocationId || getLocationEntity(locations.find((location) => location.id === quickLocationId)) !== entityFilter)) {
        setQuickLocationId(preferredLocation.id);
        return;
      }
    }

    if (!quickLocationId && orderedLocations.length > 0) {
      setQuickLocationId(orderedLocations[0].id);
    }
  }, [entityFilter, locations, orderedLocations, quickLocationId]);

  const getItemStock = (itemId: string) => {
    const itemStock = allStock.filter((stockRow) => stockRow.item_id === itemId);
    return itemStock.reduce((sum, stockRow) => sum + (stockRow.available_quantity || 0), 0);
  };

  const stockItemIds = React.useMemo(() => new Set(allStock.map((stockRow) => stockRow.item_id)), [allStock]);
  const activeItems = items.filter((item) => item.is_active && (entityFilter === 'all' || stockItemIds.has(item.id)));

  const orphans = useInventoryOrphans(getItemStock, activeItems);
  const hardDelete = useInventoryItemHardDelete();

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      !searchTerm ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = categoryFilter === 'all' || item.category_id === categoryFilter;

    return matchesSearch && matchesCategory && item.is_active;
  });

  const visibleRows = filteredItems.filter((item) => entityFilter !== 'all' || showZeroStock || getItemStock(item.id) > 0);

  const getItemLocationRows = (itemId: string) =>
    allStock.filter((stockRow) => stockRow.item_id === itemId && stockRow.location);

  const renderLocationEntityBadges = (itemId: string) => {
    if (entityFilter !== 'all') return null;
    const itemLocations = getItemLocationRows(itemId);
    if (itemLocations.length === 0) return null;

    return (
      <div className="mt-1 flex flex-wrap gap-1">
        {itemLocations.map((stockRow) => {
          const entity = getLocationEntity(stockRow.location);
          return (
            <Badge
              key={`${stockRow.item_id}-${stockRow.location_id}`}
              variant="outline"
              className={cn(
                'rounded-full px-2 py-0 text-[11px] font-medium',
                entity === 'lowboy'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
                  : 'border-primary/20 bg-primary/10 text-primary',
              )}
            >
              {stockRow.location?.name}
              <span className="ml-1 text-muted-foreground">·</span>
              <span className="ml-1">{INVENTORY_LOCATION_ENTITY_LABELS[entity]}</span>
            </Badge>
          );
        })}
      </div>
    );
  };

  const getStockStatus = (item: any) => {
    const totalStock = getItemStock(item.id);

    if (totalStock === 0) {
      return { label: 'Sin Stock', className: 'border-danger/20 bg-danger/10 text-danger', icon: AlertTriangle };
    }

    if (totalStock <= item.minimum_stock) {
      return { label: 'Stock Bajo', className: 'border-warning/20 bg-warning/10 text-warning', icon: AlertTriangle };
    }

    return { label: 'Normal', className: 'border-primary/20 bg-primary/10 text-primary', icon: Package };
  };

  if (isLoading) {
    return (
      <Card className="inventory-panel border-border/70 bg-card/80 shadow-sm">
        <CardContent className="flex items-center justify-center gap-2 py-10">
          <Loader2 className="size-5 animate-spin text-foreground" />
          <span className="text-sm text-muted-foreground">Cargando inventario...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="inventory-panel border-border/70 bg-card/80 shadow-sm">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg text-foreground sm:text-xl">
                <Package className="size-5 text-primary" />
                Stock de Productos
              </CardTitle>
              <CardDescription>
                Visualiza existencias, registra movimientos rápidos y administra el catálogo activo de bodega.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Dialog open={showCreateProductForm} onOpenChange={setShowCreateProductForm}>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowCreateProductForm(true)}
                  className="gap-2 border-border/70 bg-background/60"
                >
                  <Plus className="size-4" />
                  Nuevo Producto
                </Button>
                <DialogContent className="inventory-dialog max-h-[90vh] max-w-2xl border-border/70 bg-card overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Agregar Nuevo Producto</DialogTitle>
                    <DialogDescription className="sr-only">Formulario para crear un nuevo producto en el catálogo de inventario.</DialogDescription>
                  </DialogHeader>
                  <ProductFormModal onSuccess={() => setShowCreateProductForm(false)} onClose={() => setShowCreateProductForm(false)} />
                </DialogContent>
              </Dialog>

              <Dialog open={showEntryForm} onOpenChange={setShowEntryForm}>
                <Button size="sm" onClick={() => setShowEntryForm(true)} className="gap-2">
                  <Plus className="size-4" />
                  Nueva Entrada
                </Button>
                <DialogContent className="inventory-dialog max-h-[90vh] max-w-3xl border-border/70 bg-card overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Registrar Entrada de Inventario</DialogTitle>
                    <DialogDescription className="sr-only">Formulario para registrar una entrada de stock en bodega.</DialogDescription>
                  </DialogHeader>
                  <SimpleEntryForm entityFilter={entityFilter} onSuccess={() => setShowEntryForm(false)} />
                </DialogContent>
              </Dialog>

              <Dialog open={showExitForm} onOpenChange={setShowExitForm}>
                <Button size="sm" variant="destructive" onClick={() => setShowExitForm(true)} className="gap-2">
                  <Minus className="size-4" />
                  Nueva Salida
                </Button>
                <DialogContent className="inventory-dialog max-h-[90vh] max-w-3xl border-border/70 bg-card overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Registrar Salida de Inventario</DialogTitle>
                    <DialogDescription className="sr-only">Formulario para registrar una salida de stock en bodega.</DialogDescription>
                  </DialogHeader>
                  <SimpleExitForm entityFilter={entityFilter} onSuccess={() => setShowExitForm(false)} />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-xl border border-border/70 bg-background/50 p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge className="gap-1 border-primary/20 bg-primary/10 text-primary hover:bg-primary/10">
                <Sparkles className="size-3.5" />
                Movimiento rápido
              </Badge>
              <Badge variant="outline">{activeItems.length} productos activos</Badge>
              <Badge variant="outline">{orderedLocations.length} ubicaciones</Badge>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
              <div className="md:col-span-2">
                <Select value={quickItemId} onValueChange={setQuickItemId}>
                  <SelectTrigger className="border-border/70 bg-background/60">
                    <SelectValue placeholder="Seleccionar producto" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Select value={quickType} onValueChange={(value) => setQuickType(value as 'entry' | 'exit')}>
                  <SelectTrigger className="border-border/70 bg-background/60">
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
                  <SelectTrigger className="border-border/70 bg-background/60">
                    <SelectValue placeholder="Ubicación" />
                  </SelectTrigger>
                  <SelectContent>
                    {orderedLocations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                        {entityFilter === 'all' ? ` · ${INVENTORY_LOCATION_ENTITY_LABELS[getLocationEntity(location)]}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Input
                  type="number"
                  min={1}
                  value={quickQty}
                  onChange={(e) => setQuickQty(parseInt(e.target.value || '1', 10))}
                  placeholder="Cantidad"
                  className="border-border/70 bg-background/60"
                />
              </div>
              <div>
                <Input
                  type="number"
                  min={0}
                  value={quickUnitCost}
                  onChange={(e) => setQuickUnitCost(parseFloat(e.target.value || '0'))}
                  placeholder="Costo unitario"
                  disabled={quickType !== 'entry'}
                  className="border-border/70 bg-background/60"
                />
              </div>
            </div>

            <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-card/70 px-3 py-2">
                <Switch checked={quickGenerateCost} onCheckedChange={setQuickGenerateCost} disabled={quickType !== 'entry'} />
                <div>
                  <p className="text-sm font-medium text-foreground">Generar costo automáticamente</p>
                  <p className="text-xs text-muted-foreground">Disponible solo para entradas rápidas.</p>
                </div>
              </div>

              <Button
                onClick={() => {
                  if (!quickItemId || !quickLocationId || quickQty <= 0) {
                    toast.error('Completa producto, ubicación y cantidad');
                    return;
                  }
                  createMovement.mutate({
                    item_id: quickItemId,
                    location_id: quickLocationId,
                    movement_type: quickType,
                    quantity: quickQty,
                    unit_cost: quickType === 'entry' ? quickUnitCost : 0,
                    total_cost: quickType === 'entry' ? quickQty * quickUnitCost : 0,
                    movement_date: businessClock.nowISO(),
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
                disabled={createMovement.isPending}
              >
                {createMovement.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Registrar movimiento
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border-border/70 bg-background/60 pl-10"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full border-border/70 bg-background/60 xl:w-[220px]">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
              <Button
                variant={showZeroStock ? 'default' : 'outline'}
                onClick={() => setShowZeroStock((value) => !value)}
                className={cn('shrink-0 whitespace-nowrap', !showZeroStock && 'border-border/70 bg-background/60')}
              >
                {showZeroStock ? 'Mostrar todo' : 'Ocultar sin stock'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setViewMode((value) => (value === 'table' ? 'cards' : 'table'))}
                className="shrink-0 whitespace-nowrap border-border/70 bg-background/60"
              >
                {viewMode === 'table' ? 'Vista Tarjetas' : 'Vista Tabla'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCleanup(true);
                  orphans.scan();
                }}
                disabled={entityFilter !== 'all'}
                className="shrink-0 whitespace-nowrap border-border/70 bg-background/60"
              >
                Limpiar huérfanos
              </Button>
              {isAdmin ? (
                <Button
                  variant="outline"
                  onClick={() => setShowDuplicateMerge(true)}
                  className="shrink-0 whitespace-nowrap border-border/70 bg-background/60"
                >
                  Fusionar duplicados
                </Button>
              ) : null}
            </div>
          </div>

          {visibleRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 bg-background/40 py-10 text-center text-sm text-muted-foreground">
              No se encontraron productos con los filtros actuales.
            </div>
          ) : viewMode === 'table' ? (
            <div className="overflow-x-auto rounded-xl border border-border/70 bg-background/40">
              <table className="min-w-[500px] w-full text-sm">
                <thead>
                  <tr className="border-b border-border/70 text-muted-foreground">
                    <th className="px-4 py-3 text-left font-medium">Producto</th>
                    <th className="px-4 py-3 text-left font-medium">SKU</th>
                    <th className="px-4 py-3 text-right font-medium">Stock</th>
                    {isAdmin ? <th className="px-4 py-3 text-right font-medium">Precio Venta</th> : null}
                    <th className="px-4 py-3 text-left font-medium">Estado</th>
                    <th className="px-4 py-3 text-right font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((item) => {
                    const totalStock = getItemStock(item.id);
                    const status = getStockStatus(item);
                    const StatusIcon = status.icon;
                    const isPreparing = hardDelete.preparingId === item.id;
                    const salePrice = getSalePrice(item, systemSettings.defaultSaleMarkupPercent);

                    return (
                      <tr key={item.id} className="border-b border-border/60 transition-colors hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-foreground">{item.name}</p>
                            {item.is_critical ? <Badge variant="outline" className="mt-1 border-danger/20 bg-danger/10 text-danger">Crítico</Badge> : null}
                            {renderLocationEntityBadges(item.id)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{item.sku || '-'}</td>
                        <td className="px-4 py-3 text-right font-medium text-foreground">{totalStock} {item.unit_of_measure}</td>
                        {isAdmin ? (
                          <td className="px-4 py-3 text-right">
                            <TooltipProvider delayDuration={200}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="font-medium text-foreground cursor-default">
                                    ${salePrice.price.toLocaleString('es-CL')}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>{describeSalePriceSource(salePrice)}</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </td>
                        ) : null}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <StatusIcon className="size-4 text-muted-foreground" />
                            <Badge variant="outline" className={cn('font-semibold', status.className)}>{status.label}</Badge>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {isMobile ? (
                            <div className="flex justify-end">
                              <Button size="sm" variant="outline" onClick={() => setSelectedProductId(item.id)} className="border-border/70 bg-background/60">
                                Ver
                              </Button>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              <Button size="sm" variant="outline" onClick={() => setSelectedProductId(item.id)} className="border-border/70 bg-background/60">
                                Ver
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => { setEditProductId(item.id); setShowEditProductForm(true); }} className="border-border/70 bg-background/60">
                                Editar
                              </Button>
                              <Button size="sm" variant="secondary" onClick={() => { setShowExitForm(true); setSelectedProductId(item.id); }}>
                                Salida
                              </Button>
                              <Button size="sm" variant="secondary" onClick={() => { setShowEntryForm(true); setSelectedProductId(item.id); }}>
                                Entrada
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={async () => {
                                  const candidate = await hardDelete.prepareDelete(item.id, item.name, getItemStock);
                                  if (candidate) setDeleteCandidate(candidate);
                                }}
                                disabled={isPreparing}
                              >
                                {isPreparing ? <Loader2 className="size-4 animate-spin" /> : 'Eliminar'}
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {visibleRows.map((item) => {
                const totalStock = getItemStock(item.id);
                const status = getStockStatus(item);
                const StatusIcon = status.icon;
                const isPreparing = hardDelete.preparingId === item.id;
                const salePrice = getSalePrice(item, systemSettings.defaultSaleMarkupPercent);

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedProductId(item.id)}
                    className="cursor-pointer rounded-xl border border-border/70 bg-background/50 p-4 transition-colors hover:bg-muted/30"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-medium text-foreground">{item.name}</h4>
                          {item.is_critical ? <Badge variant="outline" className="border-danger/20 bg-danger/10 text-danger">Crítico</Badge> : null}
                        </div>
                        {item.sku ? <p className="mt-1 text-sm text-muted-foreground">SKU: {item.sku}</p> : null}
                        {renderLocationEntityBadges(item.id)}
                        {isAdmin ? (
                          <p className="mt-1 text-sm text-muted-foreground">
                            Venta: <span className="font-medium text-foreground">${salePrice.price.toLocaleString('es-CL')}</span>
                            {' '}
                            ({describeSalePriceSource(salePrice)})
                          </p>
                        ) : null}
                        <div className="mt-3 flex items-center gap-2">
                          <StatusIcon className="size-4 text-muted-foreground" />
                          <Badge variant="outline" className={cn('font-semibold', status.className)}>{status.label}</Badge>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-2xl font-bold text-foreground">{totalStock}</p>
                        <p className="text-xs text-muted-foreground">{item.unit_of_measure}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="outline" onClick={() => { setEditProductId(item.id); setShowEditProductForm(true); }} className="border-border/70 bg-background/60">
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={async () => {
                          const candidate = await hardDelete.prepareDelete(item.id, item.name, getItemStock);
                          if (candidate) setDeleteCandidate(candidate);
                        }}
                        disabled={isPreparing}
                      >
                        {isPreparing ? <Loader2 className="size-4 animate-spin" /> : 'Eliminar'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-2 text-sm text-muted-foreground">
            Mostrando
            <Badge variant="outline" className="border-primary/20 bg-primary/10 font-semibold text-primary">
              {visibleRows.length}
            </Badge>
            de {activeItems.length} productos activos
          </div>
        </CardContent>
      </Card>

      <ProductDrawer productId={selectedProductId} open={!!selectedProductId} onClose={() => setSelectedProductId(null)} />

      <Dialog open={showEditProductForm} onOpenChange={setShowEditProductForm}>
        <DialogContent className="inventory-dialog max-h-[90vh] max-w-2xl border-border/70 bg-card">
          <DialogHeader>
            <DialogTitle>Editar Producto</DialogTitle>
            <DialogDescription className="sr-only">Formulario para editar los datos de un producto del catálogo.</DialogDescription>
          </DialogHeader>
          {editProductId ? (
            <ProductFormModal
              product={items.find((item) => item.id === editProductId)}
              onSuccess={() => setShowEditProductForm(false)}
              onClose={() => setShowEditProductForm(false)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={showCleanup} onOpenChange={setShowCleanup}>
        <DialogContent className="inventory-dialog max-w-3xl border-border/70 bg-card">
          <DialogHeader>
            <DialogTitle>Limpiar ítems huérfanos</DialogTitle>
            <DialogDescription className="sr-only">Lista de ítems sin stock ni movimientos activos, con opción de marcarlos inactivos o eliminarlos.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Ítems sin stock, sin movimientos activos y potencialmente residuales. Puedes marcarlos como inactivos o eliminarlos.
            </p>
            <div className="max-h-60 overflow-auto rounded-xl border border-border/70 bg-background/40">
              {orphans.isScanning ? (
                <div className="p-4 text-sm text-muted-foreground">Buscando ítems...</div>
              ) : orphans.orphans.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">No se detectaron ítems huérfanos.</div>
              ) : (
                <ul className="divide-y divide-border/70">
                  {orphans.orphans.map((orphan) => (
                    <li key={orphan.id} className="flex items-center justify-between p-3">
                      <span className="text-sm text-foreground">{orphan.name}</span>
                      <Badge variant="secondary">Stock: {orphan.stock}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
              <Button variant="secondary" onClick={orphans.scan} disabled={orphans.isScanning || orphans.isCleaning}>
                Reescanear
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => orphans.deactivateOrphans(orphans.orphans.map(o => o.id))} disabled={orphans.isScanning || orphans.isCleaning || orphans.orphans.length === 0}>
                  Marcar inactivos
                </Button>
                <Button variant="destructive" onClick={() => orphans.deleteOrphans(orphans.orphans.map(o => o.id))} disabled={orphans.isScanning || orphans.isCleaning || orphans.orphans.length === 0}>
                  Eliminar definitivamente
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDuplicateMerge} onOpenChange={setShowDuplicateMerge}>
        <DialogContent className="inventory-dialog max-h-[90vh] max-w-6xl border-border/70 bg-card">
          <DialogHeader>
            <DialogTitle>Administrar Productos Duplicados</DialogTitle>
            <DialogDescription className="sr-only">Panel para revisar y fusionar productos duplicados del catálogo de inventario.</DialogDescription>
          </DialogHeader>
          <DuplicateProductsPanel onMerged={() => setShowDuplicateMerge(false)} />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteCandidate} onOpenChange={(open) => !open && !hardDelete.isDeleting && setDeleteCandidate(null)}>
        <AlertDialogContent className="border-border/70 bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <Trash2 className="size-4 text-danger" />
              {deleteCandidate?.force ? 'Eliminar con limpieza forzada' : 'Eliminar producto'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteCandidate?.force
                ? `"${deleteCandidate.name}" tiene stock o movimientos activos. La limpieza forzada vaciará stock, eliminará movimientos asociados y borrará el ítem definitivamente.`
                : `Esta acción eliminará definitivamente "${deleteCandidate?.name}" del inventario.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={hardDelete.isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteCandidate) {
                  hardDelete.deleteItem(
                    { id: deleteCandidate.id, force: deleteCandidate.force },
                    { onSuccess: () => setDeleteCandidate(null) },
                  );
                }
              }}
              disabled={hardDelete.isDeleting}
              className="bg-danger text-danger-foreground hover:bg-danger/90"
            >
              {hardDelete.isDeleting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {deleteCandidate?.force ? 'Eliminar forzadamente' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
