import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import { useInventoryMovements, useInventoryLocations, type InventoryMovement } from '@/hooks/useInventory';
import { MovementDetailsModal } from './MovementDetailsModal';
import { MovementExportOptions } from './MovementExportOptions';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export const MovementsHistoryTable = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [sortBy, setSortBy] = useState<'date' | 'type' | 'product' | 'location' | 'quantity' | 'cost' | 'document'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedMovement, setSelectedMovement] = useState<InventoryMovement | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);

  const { data: movements = [], isLoading, refetch } = useInventoryMovements(200);
  const { data: locations = [] } = useInventoryLocations();

  const activeMovements = movements.filter(movement => movement.status === 'active');

  // Filter movements
  const filteredMovements = activeMovements.filter(movement => {
    // If no search term, show all (don't filter by search)
    const matchesSearch = !searchTerm.trim() || (
      (movement.item?.name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (movement.reference_document?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (movement.reason?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (movement.batch_number?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (movement.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    
    const matchesType = typeFilter === 'all' || movement.movement_type === typeFilter;
    const matchesLocation = locationFilter === 'all' || movement.location_id === locationFilter;
    
    const movementDate = new Date(movement.movement_date);
    const matchesDateFrom = !dateFrom || movementDate >= dateFrom;
    const matchesDateTo = !dateTo || movementDate <= dateTo;

    return matchesSearch && matchesType && matchesLocation && matchesDateFrom && matchesDateTo;
  });


  // Sort movements
  const sortedMovements = [...filteredMovements].sort((a, b) => {
    let aValue: any, bValue: any;
    
    switch (sortBy) {
      case 'date':
        aValue = new Date(a.movement_date).getTime();
        bValue = new Date(b.movement_date).getTime();
        break;
      case 'type':
        aValue = a.movement_type || '';
        bValue = b.movement_type || '';
        break;
      case 'product':
        aValue = (a.item?.name || '').toLowerCase();
        bValue = (b.item?.name || '').toLowerCase();
        break;
      case 'location':
        aValue = (a.location?.name || '').toLowerCase();
        bValue = (b.location?.name || '').toLowerCase();
        break;
      case 'quantity':
        aValue = a.quantity;
        bValue = b.quantity;
        break;
      case 'cost':
        aValue = a.total_cost || 0;
        bValue = b.total_cost || 0;
        break;
      case 'document':
        aValue = (a.reference_document || '').toLowerCase();
        bValue = (b.reference_document || '').toLowerCase();
        break;
      default:
        return 0;
    }
    
    if (sortOrder === 'asc') {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    }
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

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const handleViewDetails = (movement: InventoryMovement) => {
    setSelectedMovement(movement);
    setShowDetails(true);
  };

  const handleRefresh = () => {
    refetch();
  };

  const handleExportData = () => {
    setShowExportOptions(true);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setTypeFilter('all');
    setLocationFilter('all');
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  if (isLoading) {
    return (
      <Card className="border-border/70 bg-card/80 shadow-sm">
        <CardContent className="flex items-center justify-center gap-2 py-10">
          <RefreshCw className="size-5 animate-spin text-foreground" />
          <span className="text-sm text-muted-foreground">Cargando historial de movimientos...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-border/70 bg-card/80 shadow-sm">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="text-lg text-foreground sm:text-xl">Historial de Movimientos</CardTitle>
              <CardDescription>
                Revisa entradas, salidas y trazabilidad documental del inventario operativo.
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{sortedMovements.length} resultados</Badge>
              <Badge variant="outline">{activeMovements.length} movimientos activos</Badge>
            </div>
          </div>

          <div className="flex flex-col gap-3 xl:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por producto, documento o motivo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border-border/70 bg-background/60 pl-10"
              />
            </div>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full border-border/70 bg-background/60 xl:w-[170px]">
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
              <SelectTrigger className="w-full border-border/70 bg-background/60 xl:w-[210px]">
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

            <Button variant="outline" onClick={handleRefresh} className="border-border/70 bg-background/60">
              <RefreshCw className="mr-2 size-4" />
              Actualizar
            </Button>
            <Button variant="outline" onClick={handleExportData} className="border-border/70 bg-background/60">
              <Download className="mr-2 size-4" />
              Exportar
            </Button>
            <Button variant="outline" onClick={clearFilters} className="border-border/70 bg-background/60">
              <X className="mr-2 size-4" />
              Limpiar
            </Button>
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
                      onClick={() => handleSort('date')}
                      className="h-auto p-0 font-semibold"
                    >
                      Fecha
                      <ArrowUpDown className="ml-2 size-4" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" onClick={() => handleSort('type')} className="h-auto p-0 font-semibold">
                      Tipo <ArrowUpDown className="ml-2 size-4" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" onClick={() => handleSort('product')} className="h-auto p-0 font-semibold">
                      Producto <ArrowUpDown className="ml-2 size-4" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" onClick={() => handleSort('location')} className="h-auto p-0 font-semibold">
                      Ubicación <ArrowUpDown className="ml-2 size-4" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleSort('quantity')}
                      className="h-auto p-0 font-semibold"
                    >
                      Cantidad
                      <ArrowUpDown className="ml-2 size-4" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleSort('cost')}
                      className="h-auto p-0 font-semibold"
                    >
                      Costo
                      <ArrowUpDown className="ml-2 size-4" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" onClick={() => handleSort('document')} className="h-auto p-0 font-semibold">
                      Documento <ArrowUpDown className="ml-2 size-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedMovements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                      No se encontraron movimientos que coincidan con los filtros.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedMovements.map((movement) => (
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
                        {movement.location?.name}
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
                          <div className="space-y-1">
                            <code className="rounded bg-muted px-1 text-sm">
                              {movement.reference_document}
                            </code>
                            {(() => {
                              if (!movement.reference_document) return null;
                              const uniqueItems = new Set(
                                activeMovements
                                  .filter((item) => item.reference_document === movement.reference_document)
                                  .map((item) => item.item_id)
                              );
                              return uniqueItems.size > 1 ? (
                                <Badge variant="secondary" className="text-xs">
                                  Compra múltiple ({uniqueItems.size} productos)
                                </Badge>
                              ) : null;
                            })()}
                          </div>
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
        </CardContent>
      </Card>

      {/* Export Options Modal */}
      <Dialog open={showExportOptions} onOpenChange={setShowExportOptions}>
        <DialogContent className="max-w-2xl border-border/70 bg-card">
          <MovementExportOptions
            movements={sortedMovements}
            appliedFilters={{
              searchTerm,
              typeFilter,
              locationFilter,
              dateFrom,
              dateTo
            }}
            onClose={() => setShowExportOptions(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-h-[90vh] max-w-4xl border-border/70 bg-card overflow-y-auto">
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
