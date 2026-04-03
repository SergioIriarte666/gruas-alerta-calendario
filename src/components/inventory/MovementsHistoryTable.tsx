import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { 
  Search, 
  Filter, 
  Download, 
  Calendar as CalendarIcon, 
  Eye, 
  MoreHorizontal,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  Edit
} from 'lucide-react';
import { useInventoryMovements, useInventoryCategories, useInventoryLocations, type InventoryMovement } from '@/hooks/useInventory';
import { MovementDetailsModal } from './MovementDetailsModal';
import { MovementExportOptions } from './MovementExportOptions';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
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
  const { data: categories = [] } = useInventoryCategories();
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
      entry: { label: 'Entrada', icon: TrendingUp, className: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 border-violet-200' },
      exit: { label: 'Salida', icon: TrendingDown, className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200' },
      transfer: { label: 'Transferencia', icon: ArrowUpDown, className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200' },
      adjustment: { label: 'Ajuste', icon: ArrowUpDown, className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200' },
    };
    
    const config = badges[type as keyof typeof badges] || badges.adjustment;
    const Icon = config.icon;
    
    return (
      <Badge variant="outline" className={cn("flex items-center gap-1 font-semibold", config.className)}>
        <Icon className="w-3 h-3" />
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
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8 text-muted-foreground">
            Cargando historial de movimientos...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Movements Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle>Historial de Movimientos</CardTitle>
            <div className="flex flex-col md:flex-row gap-3 md:items-center">
              {/* Simple Filters */}
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 focus-visible:ring-violet-500"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full md:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="entry">Entradas</SelectItem>
                  <SelectItem value="exit">Salidas</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={handleExportData} className="border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-300 dark:hover:bg-violet-900/20">
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
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
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Ubicación</TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('quantity')}
                    className="h-auto p-0 font-semibold"
                  >
                    Cantidad
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('cost')}
                    className="h-auto p-0 font-semibold"
                  >
                    Costo
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>Documento</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedMovements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No se encontraron movimientos que coincidan con los filtros
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
                          "font-bold",
                          movement.movement_type === 'entry' ? "text-violet-600" : "text-red-600"
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
                          "font-bold",
                          movement.movement_type === 'entry' ? "text-violet-600" : "text-red-600"
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
                          <code className="text-sm bg-muted px-1 rounded">
                            {movement.reference_document}
                          </code>
                          {/* Show if this document has multiple products */}
                          {activeMovements.filter(m => m.reference_document === movement.reference_document && m.reference_document).length > 1 && (
                            <Badge variant="secondary" className="text-xs">
                              Compra múltiple ({activeMovements.filter(m => m.reference_document === movement.reference_document).length} productos)
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewDetails(movement)}>
                            <Eye className="w-4 h-4 mr-2" />
                            Ver detalles
                          </DropdownMenuItem>
                          {movement.status === 'active' && (
                            <DropdownMenuItem onClick={() => handleViewDetails(movement)}>
                              <Edit className="w-4 h-4 mr-2" />
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
        </CardContent>
      </Card>

      {/* Export Options Modal */}
      <Dialog open={showExportOptions} onOpenChange={setShowExportOptions}>
        <DialogContent className="max-w-2xl">
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

      {/* Movement Details Modal */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
