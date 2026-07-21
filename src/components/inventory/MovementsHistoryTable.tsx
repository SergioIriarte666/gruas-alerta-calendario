import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  Search,
  Download,
  Eye,
  MoreHorizontal,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  Edit,
  RefreshCw,
  X,
} from 'lucide-react';
import {
  usePagedInventoryMovements,
  useInventoryLocations,
  fetchInventoryMovementsForExport,
  type InventoryMovement,
  type InventoryMovementQueryFilters,
} from '@/hooks/useInventory';
import { MovementDetailsModal } from './MovementDetailsModal';
import { MovementExportOptions } from './MovementExportOptions';
import DatePickerInput from '@/components/common/DatePickerInput';
import { AppPagination } from '@/components/shared/AppPagination';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import {
  INVENTORY_LOCATION_ENTITY_LABELS,
  getLocationEntity,
  type InventoryEntityFilter,
} from '@/utils/inventoryEntity';

const logger = createLogger('InventoryMovements');

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 350;

interface MovementsHistoryTableProps {
  entityFilter?: InventoryEntityFilter;
}

export const MovementsHistoryTable: React.FC<MovementsHistoryTableProps> = ({ entityFilter = 'all' }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [selectedMovement, setSelectedMovement] = useState<InventoryMovement | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [exportMovements, setExportMovements] = useState<InventoryMovement[]>([]);
  const [isPreparingExport, setIsPreparingExport] = useState(false);

  // Debounce del término de búsqueda para no disparar una query por tecla.
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(searchTerm.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [searchTerm]);

  const filters: InventoryMovementQueryFilters = useMemo(
    () => ({
      entityFilter,
      movementType: typeFilter,
      locationId: locationFilter,
      search: debouncedSearch,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      sortDir,
    }),
    [entityFilter, typeFilter, locationFilter, debouncedSearch, dateFrom, dateTo, sortDir],
  );

  // Cualquier cambio de filtro vuelve a la primera página.
  useEffect(() => {
    setPage(1);
  }, [filters]);

  const { data, error, isLoading, isFetching, refetch } = usePagedInventoryMovements(page, PAGE_SIZE, filters);
  const movements = data?.movements ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const { data: locations = [] } = useInventoryLocations(entityFilter);

  const movementAdjustmentReferences = movements.map((movement) => `inv_movement:${movement.id}`);
  const { data: intercompanyByReference = {} } = useQuery({
    queryKey: ['inventory-movement-intercompany-adjustments', movementAdjustmentReferences],
    enabled: movementAdjustmentReferences.length > 0,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('intercompany_adjustments')
        .select('reference, amount')
        .in('reference', movementAdjustmentReferences);
      if (error) return {};
      return (rows || []).reduce((acc, row) => {
        if (row.reference) acc[row.reference] = Number(row.amount || 0);
        return acc;
      }, {} as Record<string, number>);
    },
  });

  const getMovementBadge = (type: string) => {
    const badges = {
      entry: { label: 'Entrada', icon: TrendingUp, className: 'border-success/20 bg-success/10 text-success' },
      exit: { label: 'Salida', icon: TrendingDown, className: 'border-danger/20 bg-danger/10 text-danger' },
      transfer: { label: 'Transferencia', icon: ArrowUpDown, className: 'border-info/20 bg-info/10 text-info' },
      adjustment: { label: 'Ajuste', icon: ArrowUpDown, className: 'border-warning/20 bg-warning/10 text-warning' },
    };

    const config = badges[type as keyof typeof badges] || badges.adjustment;
    const Icon = config.icon;

    return (
      <Badge variant="outline" className={cn("flex items-center gap-1 font-semibold", config.className)}>
        <Icon className="size-3" />
        {config.label}
      </Badge>
    );
  };

  const handleViewDetails = (movement: InventoryMovement) => {
    setSelectedMovement(movement);
    setShowDetails(true);
  };

  const handleRefresh = () => {
    refetch();
  };

  const handleExportData = async () => {
    setIsPreparingExport(true);
    try {
      const all = await fetchInventoryMovementsForExport(filters);
      setExportMovements(all);
      setShowExportOptions(true);
    } catch (error) {
      logger.error('No se pudieron preparar los movimientos para exportar', error);
      toast.error('Error al preparar la exportación', {
        description: error instanceof Error ? error.message : 'Inténtalo nuevamente.',
      });
    } finally {
      setIsPreparingExport(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setDebouncedSearch('');
    setTypeFilter('all');
    setLocationFilter('all');
    setDateFrom('');
    setDateTo('');
    setSortDir('desc');
    setPage(1);
  };

  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="space-y-4">
      <Card className="inventory-panel border-border/70 bg-card/80 shadow-sm">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="text-lg text-foreground sm:text-xl">Historial de Movimientos</CardTitle>
              <CardDescription>
                Revisa entradas, salidas y trazabilidad documental del inventario operativo.
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {error ? (
                <Badge variant="destructive">Error al cargar</Badge>
              ) : (
                <Badge variant="outline">{total} resultados</Badge>
              )}
              {total > 0 ? (
                <Badge variant="outline">
                  Mostrando {rangeStart}–{rangeEnd}
                </Badge>
              ) : null}
              {isFetching ? (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <RefreshCw className="size-3 animate-spin" />
                  Actualizando…
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-end">
            <div className="relative flex-1 xl:min-w-[13.75rem]">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por producto, documento o motivo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border-border/70 bg-background/60 pl-10"
              />
            </div>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full border-border/70 bg-background/60 xl:w-[10.625rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="entry">Entradas</SelectItem>
                <SelectItem value="exit">Salidas</SelectItem>
                <SelectItem value="transfer">Transferencias</SelectItem>
                <SelectItem value="adjustment">Ajustes</SelectItem>
              </SelectContent>
            </Select>

            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-full border-border/70 bg-background/60 xl:w-[13.125rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las ubicaciones</SelectItem>
                {locations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Desde</Label>
              <DatePickerInput
                value={dateFrom}
                onChange={setDateFrom}
                placeholder="Sin límite"
                className="border-border/70 bg-background/60 xl:w-[10rem]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Hasta</Label>
              <DatePickerInput
                value={dateTo}
                onChange={setDateTo}
                placeholder="Sin límite"
                className="border-border/70 bg-background/60 xl:w-[10rem]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={handleRefresh} className="border-border/70 bg-background/60">
                <RefreshCw className="mr-2 size-4" />
                Actualizar
              </Button>
              <Button
                variant="outline"
                onClick={handleExportData}
                disabled={isPreparingExport || total === 0}
                className="border-border/70 bg-background/60"
              >
                <Download className="mr-2 size-4" />
                {isPreparingExport ? 'Preparando…' : 'Exportar'}
              </Button>
              <Button variant="outline" onClick={clearFilters} className="border-border/70 bg-background/60">
                <X className="mr-2 size-4" />
                Limpiar
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="overflow-x-auto rounded-xl border border-border/70 bg-background/40">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => setSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                      className="h-auto p-0 font-semibold"
                    >
                      Fecha
                      <ArrowUpDown className="ml-2 size-4" />
                    </Button>
                  </TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Ubicación</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Costo</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                      <span className="inline-flex items-center gap-2">
                        <RefreshCw className="size-4 animate-spin" />
                        Cargando historial de movimientos...
                      </span>
                    </TableCell>
                  </TableRow>
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center">
                      <div className="mx-auto flex max-w-md flex-col items-center gap-3">
                        <p className="font-medium text-destructive">No se pudo cargar el historial de movimientos.</p>
                        <p className="text-sm text-muted-foreground">
                          {error instanceof Error ? error.message : 'Actualiza la consulta para volver a intentarlo.'}
                        </p>
                        <Button variant="outline" size="sm" onClick={() => refetch()}>
                          <RefreshCw className="mr-2 size-4" />
                          Reintentar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : movements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                      No se encontraron movimientos que coincidan con los filtros.
                    </TableCell>
                  </TableRow>
                ) : (
                  movements.map((movement) => (
                    <TableRow key={movement.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {format(new Date(movement.movement_date), 'dd/MM/yyyy')}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {format(new Date(movement.movement_date), 'HH:mm')}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getMovementBadge(movement.movement_type)}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{movement.item?.name}</div>
                          {movement.batch_number && (
                            <div className="text-sm text-muted-foreground">
                              Lote: {movement.batch_number}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span>{movement.location?.name}</span>
                          {movement.movement_type === 'transfer' && movement.destination_location ? (
                            <>
                              <span className="text-muted-foreground">→</span>
                              <span>{movement.destination_location.name}</span>
                            </>
                          ) : null}
                          {entityFilter === 'all' && movement.location ? (
                            <Badge
                              variant="outline"
                              className={cn(
                                'rounded-full px-2 py-0 text-xs font-medium',
                                getLocationEntity(movement.location) === 'lowboy'
                                  ? 'border-success/30 bg-success-soft text-success'
                                  : 'border-primary/20 bg-primary/10 text-primary',
                              )}
                            >
                              {INVENTORY_LOCATION_ENTITY_LABELS[getLocationEntity(movement.location)]}
                            </Badge>
                          ) : null}
                          {intercompanyByReference[`inv_movement:${movement.id}`] !== undefined ? (
                            <Badge variant="outline" className="rounded-full border-warning/30 bg-warning-soft px-2 py-0 text-xs font-medium text-warning">
                              Intercompañía ${intercompanyByReference[`inv_movement:${movement.id}`].toLocaleString('es-CL')}
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className={cn(
                            'font-bold',
                            movement.movement_type === 'entry' ? 'text-primary' : 'text-danger'
                          )}>
                            {movement.movement_type === 'entry' ? '+' : '-'}{movement.quantity}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {movement.item?.unit_of_measure || 'unidades'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {movement.total_cost ? (
                          <span className={cn(
                            'font-bold',
                            movement.movement_type === 'entry' ? 'text-primary' : 'text-danger'
                          )}>
                            {movement.movement_type === 'entry' ? '+' : '-'}${movement.total_cost.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {movement.reference_document ? (
                          <code className="rounded bg-muted px-1 text-sm">
                            {movement.reference_document}
                          </code>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewDetails(movement)}>
                              <Eye className="size-4 mr-2" />
                              Ver detalles
                            </DropdownMenuItem>
                            {movement.status === 'active' && (
                              <DropdownMenuItem onClick={() => handleViewDetails(movement)}>
                                <Edit className="size-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <AppPagination
            className="py-2"
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>

      {/* Export Options Modal */}
      <Dialog open={showExportOptions} onOpenChange={setShowExportOptions}>
        <DialogContent className="inventory-dialog max-w-2xl border-border/70 bg-card">
          <MovementExportOptions
            movements={exportMovements}
            appliedFilters={{
              searchTerm: debouncedSearch,
              typeFilter,
              locationFilter,
              dateFrom: dateFrom ? new Date(`${dateFrom}T12:00:00`) : undefined,
              dateTo: dateTo ? new Date(`${dateTo}T12:00:00`) : undefined,
            }}
            onClose={() => setShowExportOptions(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="inventory-dialog max-h-[90vh] max-w-4xl border-border/70 bg-card overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalles del Movimiento</DialogTitle>
          </DialogHeader>
          {selectedMovement && (
            <MovementDetailsModal
              movement={selectedMovement}
              onClose={() => setShowDetails(false)}
              onRefresh={handleRefresh}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
