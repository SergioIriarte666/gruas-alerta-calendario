import * as React from 'react';
import { AlertTriangle, ArrowRightLeft, Eye, GitMerge, Loader2, Search } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { useInventoryItems, useInventoryStock, useMergeInventoryItems } from '@/hooks/useInventory';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import {
  findDuplicateCandidateGroups,
  type DuplicateCandidateGroup,
  type DuplicateCandidateItem,
  type InventorySimilaritySource,
} from '@/utils/inventoryHelper';
import { ProductDetailsModal } from './ProductDetailsModal';

interface DuplicateProductsPanelProps {
  onMerged?: () => void;
}

export const DuplicateProductsPanel: React.FC<DuplicateProductsPanelProps> = ({ onMerged }) => {
  const { isAdmin } = useUserPermissions();
  const { data: items = [] } = useInventoryItems();
  const { data: stock = [] } = useInventoryStock();
  const mergeItems = useMergeInventoryItems();

  const [searchTerm, setSearchTerm] = React.useState('');
  const [masterSelections, setMasterSelections] = React.useState<Record<string, string>>({});
  const [groupToConfirm, setGroupToConfirm] = React.useState<DuplicateCandidateGroup | null>(null);
  const [detailsProduct, setDetailsProduct] = React.useState<DuplicateCandidateItem | null>(null);

  const stockByItemId = React.useMemo(() => {
    return stock.reduce<Record<string, number>>((acc, row) => {
      acc[row.item_id] = (acc[row.item_id] || 0) + (row.available_quantity || 0);
      return acc;
    }, {});
  }, [stock]);

  const similaritySources = React.useMemo<InventorySimilaritySource[]>(() => {
    return items
      .filter((item) => item.is_active)
      .map((item) => ({
        id: item.id,
        name: item.name,
        sku: item.sku,
        unit_cost: item.unit_cost,
        created_at: item.created_at,
        is_active: item.is_active,
        current_stock: stockByItemId[item.id] || 0,
      }));
  }, [items, stockByItemId]);

  const duplicateGroups = React.useMemo(() => {
    return findDuplicateCandidateGroups(similaritySources);
  }, [similaritySources]);

  React.useEffect(() => {
    setMasterSelections((current) => {
      const next = { ...current };
      for (const group of duplicateGroups) {
        if (!next[group.id] || !group.items.some((item) => item.id === next[group.id])) {
          next[group.id] = group.suggested_master_id;
        }
      }

      for (const groupId of Object.keys(next)) {
        if (!duplicateGroups.some((group) => group.id === groupId)) {
          delete next[groupId];
        }
      }

      return next;
    });
  }, [duplicateGroups]);

  const filteredGroups = React.useMemo(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase();
    if (!normalizedTerm) return duplicateGroups;

    return duplicateGroups.filter((group) =>
      group.items.some((item) =>
        item.name.toLowerCase().includes(normalizedTerm) || item.sku?.toLowerCase().includes(normalizedTerm)
      )
    );
  }, [duplicateGroups, searchTerm]);

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No tienes permisos para acceder a esta herramienta.
        </CardContent>
      </Card>
    );
  }

  const getSelectedMaster = (group: DuplicateCandidateGroup) => {
    const selectedMasterId = masterSelections[group.id] || group.suggested_master_id;
    return group.items.find((item) => item.id === selectedMasterId) || group.items[0];
  };

  const getDuplicatesForGroup = (group: DuplicateCandidateGroup) => {
    const master = getSelectedMaster(group);
    return group.items.filter((item) => item.id !== master.id);
  };

  const handleConfirmMerge = async () => {
    if (!groupToConfirm) return;

    const master = getSelectedMaster(groupToConfirm);
    const duplicates = getDuplicatesForGroup(groupToConfirm);

    if (duplicates.length === 0) return;

    try {
      await mergeItems.mutateAsync({
        masterItemId: master.id,
        duplicateItemIds: duplicates.map((item) => item.id),
        masterName: master.name,
      });

      setGroupToConfirm(null);
      onMerged?.();
    } catch {
      // no-op: onError already handled it
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-border/70 bg-card/80 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitMerge className="size-5 text-primary" />
            Fusionar Productos Duplicados
          </CardTitle>
          <CardDescription>
            Revisa productos con nombres iguales o muy parecidos, elige el producto maestro y fusiona el resto
            sin perder movimientos, stock ni trazabilidad.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="size-4" />
            <AlertTitle>Uso recomendado</AlertTitle>
            <AlertDescription>
              Revisa primero los grupos de similitud. Los grupos exactos son seguros; los grupos similares
              requieren validación manual antes de fusionar.
            </AlertDescription>
          </Alert>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar grupos por nombre o SKU..."
              className="pl-10"
            />
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">{filteredGroups.length}</Badge>
            grupos candidatos detectados
          </div>

          {filteredGroups.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No se detectaron productos duplicados con los filtros actuales.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredGroups.map((group) => {
                const selectedMasterId = masterSelections[group.id] || group.suggested_master_id;
                const selectedMaster = getSelectedMaster(group);
                const duplicates = getDuplicatesForGroup(group);
                const totalStock = group.items.reduce((sum, item) => sum + (item.current_stock || 0), 0);

                return (
                  <Card key={group.id} className="border-border/70 bg-background/50 shadow-none">
                    <CardHeader className="pb-3">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-2">
                          <CardTitle className="text-base">
                            {selectedMaster?.name || group.items[0]?.name}
                          </CardTitle>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={group.match_type === 'exact' ? 'destructive' : 'secondary'}>
                              {group.match_type === 'exact' ? 'Coincidencia exacta' : 'Coincidencia similar'}
                            </Badge>
                            <Badge variant="outline">{Math.round(group.confidence * 100)}% confianza</Badge>
                            <Badge variant="outline">{group.items.length} items</Badge>
                            <Badge variant="outline">Stock total: {totalStock}</Badge>
                          </div>
                        </div>

                        <div className="w-full md:w-72">
                          <div className="mb-2 text-xs font-medium text-muted-foreground">Producto maestro</div>
                          <Select
                            value={selectedMasterId}
                            onValueChange={(value) =>
                              setMasterSelections((current) => ({ ...current, [group.id]: value }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar maestro" />
                            </SelectTrigger>
                            <SelectContent>
                              {group.items.map((item) => (
                                <SelectItem key={item.id} value={item.id}>
                                  {item.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-2">
                        {group.items.map((item) => {
                          const isMaster = item.id === selectedMasterId;
                          return (
                            <div
                              key={item.id}
                              className={`flex flex-col gap-3 rounded-md border p-3 md:flex-row md:items-center md:justify-between ${
                                isMaster ? 'border-primary/30 bg-primary/10' : 'border-border/70 bg-card/70'
                              }`}
                            >
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-medium">{item.name}</span>
                                  {isMaster && <Badge className="bg-primary text-primary-foreground">Maestro</Badge>}
                                  {!isMaster && <Badge variant="outline">Duplicado</Badge>}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  SKU: {item.sku || '-'} | Stock: {item.current_stock || 0} | Costo: $
                                  {Number(item.unit_cost || 0).toLocaleString('es-CL')}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">
                                  {item.match_type === 'exact'
                                    ? '100%'
                                    : `${Math.round(item.similarity_score * 100)}% similitud`}
                                </Badge>
                                <Button variant="outline" size="sm" onClick={() => setDetailsProduct(item)}>
                                  <Eye className="mr-2 size-4" />
                                  Detalles
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="rounded-md bg-muted/40 p-3 text-sm">
                        <div className="font-medium">Resultado de la fusión</div>
                        <div className="mt-1 text-muted-foreground">
                          Se conservará <strong>{selectedMaster.name}</strong> y se fusionarán {duplicates.length}{' '}
                          producto(s) duplicado(s) sobre ese registro.
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <Button
                          onClick={() => setGroupToConfirm(group)}
                          disabled={duplicates.length === 0 || mergeItems.isPending}
                          className="gap-2"
                        >
                          {mergeItems.isPending && groupToConfirm?.id === group.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <ArrowRightLeft className="size-4" />
                          )}
                          Fusionar grupo
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!groupToConfirm} onOpenChange={(open) => !open && setGroupToConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar fusión de productos</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Esta acción moverá movimientos, stock y referencias hacia el producto maestro seleccionado.
                </p>
                {groupToConfirm && (
                  <div className="rounded-md border bg-muted/30 p-3 text-sm">
                    <div>
                      Maestro: <strong>{getSelectedMaster(groupToConfirm).name}</strong>
                    </div>
                    <div>
                      Duplicados: <strong>{getDuplicatesForGroup(groupToConfirm).length}</strong>
                    </div>
                    <div className="mt-2">
                      {getDuplicatesForGroup(groupToConfirm).map((item) => item.name).join(', ')}
                    </div>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mergeItems.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmMerge} disabled={mergeItems.isPending}>
              {mergeItems.isPending ? 'Fusionando...' : 'Confirmar fusión'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ProductDetailsModal
        isOpen={!!detailsProduct}
        onClose={() => setDetailsProduct(null)}
        product={detailsProduct}
      />
    </div>
  );
};
