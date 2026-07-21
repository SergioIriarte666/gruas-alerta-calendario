import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Eye, Edit, Trash2, Copy, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, MoreHorizontal, Layers, CheckCircle, Circle, CalendarClock } from 'lucide-react';
import { Cost } from '@/types/costs';
import { businessClock } from '@/utils/businessClock';
import { Card, CardContent } from '@/components/ui/card';
import { ServiceDetailsModal } from '@/components/services/ServiceDetailsModal';
import { useServiceDetails } from '@/hooks/useServiceDetails';
import { useCostCategories } from '@/hooks/useCostCategories';
import { getCategoryLabel } from '@/utils/categoryUtils';
import { CostBatchActionBar } from './CostBatchActionBar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { getCostShortId } from '@/utils/costHelpers';

interface EnhancedCostsTableProps {
  costs: Cost[];
  onEdit: (cost: Cost) => void;
  onDelete: (cost: Cost) => void;
  onViewDetails: (cost: Cost) => void;
  onDuplicate?: (cost: Cost) => void;
  loading?: boolean;
  highlightedCostId?: string;
  selectedCosts?: Set<string>;
  onSelectionChange?: (selected: Set<string>) => void;
  onBatchUpdate?: () => void;
  onBatchMarkPaid?: () => void;
  onBatchDelete?: () => void;
  // Server-side pagination: cuando se proporcionan, el componente delega la paginación al padre
  serverPage?: number;
  serverPageSize?: number;
  serverTotal?: number;
  onServerPageChange?: (page: number) => void;
  onServerPageSizeChange?: (pageSize: number) => void;
  // En modo búsqueda activa el servidor devuelve todos los resultados sin paginar
  disableServerPagination?: boolean;
}

type SortField = 'date' | 'description' | 'category' | 'subcategory' | 'amount' | 'payment_date' | 'associated';
type SortDirection = 'asc' | 'desc';
type GroupBy = 'none' | 'date' | 'category' | 'crane' | 'operator' | 'service_folio' | 'supplier' | 'payment_status';

const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50, 100];

export const EnhancedCostsTable = ({ 
  costs, 
  onEdit, 
  onDelete, 
  onViewDetails,
  onDuplicate, 
  loading, 
  highlightedCostId,
  selectedCosts = new Set<string>(),
  onSelectionChange,
  onBatchUpdate,
  onBatchMarkPaid,
  onBatchDelete,
  serverPage,
  serverPageSize,
  serverTotal,
  onServerPageChange,
  onServerPageSizeChange,
  disableServerPagination,
}: EnhancedCostsTableProps) => {
  const isServerPaged = serverTotal !== undefined && !disableServerPagination;
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['all']));

  // Sincronizar página desde server-side pagination
  const effectivePage = isServerPaged ? (serverPage ?? 1) : currentPage;
  const effectivePageSize = isServerPaged ? (serverPageSize ?? 20) : itemsPerPage;

  const handlePageChange = (page: number) => {
    if (isServerPaged) {
      onServerPageChange?.(page);
    } else {
      setCurrentPage(page);
    }
  };

  const handlePageSizeChange = (size: number) => {
    if (isServerPaged) {
      onServerPageSizeChange?.(size);
    } else {
      setItemsPerPage(size);
      setCurrentPage(1);
    }
  };

  // Reset page when costs change (e.g. search/filter) - solo en modo client-side
  useEffect(() => {
    if (!isServerPaged) {
      setCurrentPage(1);
    }
  }, [costs, isServerPaged]);
  
  const { data: serviceDetails } = useServiceDetails(selectedServiceId);
  const { data: activeCategories = [] } = useCostCategories();

  const handleSelectAll = (checked: boolean) => {
    if (!onSelectionChange) return;
    if (checked) {
      onSelectionChange(new Set(costs.map(c => c.id)));
    } else {
      onSelectionChange(new Set());
    }
  };

  const handleSelectOne = (costId: string, checked: boolean) => {
    if (!onSelectionChange) return;
    const newSelection = new Set(selectedCosts);
    if (checked) {
      newSelection.add(costId);
    } else {
      newSelection.delete(costId);
    }
    onSelectionChange(newSelection);
  };

  const calculateSelectedTotal = () => {
    return costs
      .filter(c => selectedCosts.has(c.id))
      .reduce((sum, cost) => sum + Number(cost.amount), 0);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getAssociatedTo = useCallback((cost: Cost) => {
    if (cost.services) return `Servicio: ${cost.services.folio}`;
    if (cost.cranes) return `Grúa: ${cost.cranes.brand} ${cost.cranes.model} (${cost.cranes.license_plate})`;
    if (cost.operators) return `Operador: ${cost.operators.name}`;
    return 'N/A';
  }, []);

  const handleServiceClick = (cost: Cost) => {
    if (cost.services) {
      setSelectedServiceId(cost.services.id);
      setIsServiceModalOpen(true);
    }
  };

  const isUUID = useCallback((str: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }, []);

  const getSubcategoryDisplay = useCallback((subcategory: string) => {
    if (!subcategory) return null;
    if (isUUID(subcategory)) {
      return getCategoryLabel(activeCategories || [], subcategory);
    }
    return subcategory;
  }, [activeCategories, isUUID]);

  const getCategoryDisplay = useCallback((cost: Cost) => {
    return cost.cost_categories?.name || 'Sin categoría';
  }, []);

  // Ordenar costos
  const sortedCosts = useMemo(() => {
    return [...costs].sort((a, b) => {
      let aValue: any = '';
      let bValue: any = '';

      switch (sortField) {
        case 'date':
          aValue = new Date(a.date);
          bValue = new Date(b.date);
          break;
        case 'description':
          aValue = a.description.toLowerCase();
          bValue = b.description.toLowerCase();
          break;
        case 'category':
          aValue = getCategoryDisplay(a).toLowerCase();
          bValue = getCategoryDisplay(b).toLowerCase();
          break;
        case 'subcategory':
          aValue = (getSubcategoryDisplay(a.subcategory || '') || '').toLowerCase();
          bValue = (getSubcategoryDisplay(b.subcategory || '') || '').toLowerCase();
          break;
        case 'amount':
          aValue = Number(a.amount);
          bValue = Number(b.amount);
          break;
        case 'payment_date':
          aValue = a.payment_date ? new Date(`${a.payment_date}T12:00:00Z`).getTime() : 0;
          bValue = b.payment_date ? new Date(`${b.payment_date}T12:00:00Z`).getTime() : 0;
          break;
        case 'associated':
          aValue = getAssociatedTo(a).toLowerCase();
          bValue = getAssociatedTo(b).toLowerCase();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [costs, sortField, sortDirection, getAssociatedTo, getCategoryDisplay, getSubcategoryDisplay]);

  // Agrupar costos si es necesario
  const groupedCosts = useMemo(() => {
    if (groupBy === 'none') {
      return { 'all': sortedCosts };
    }

    const groups: Record<string, Cost[]> = {};
    
    sortedCosts.forEach(cost => {
      let key: string;
      if (groupBy === 'date') {
        key = format(new Date(`${cost.date}T12:00:00Z`), "MMMM yyyy", { locale: es });
      } else if (groupBy === 'category') {
        key = getCategoryDisplay(cost);
      } else if (groupBy === 'crane') {
        const crane = (cost as any).cranes;
        key = crane
          ? `${crane.brand || ''} ${crane.model || ''} (${crane.license_plate || ''})`.trim()
          : 'Sin grúa asignada';
      } else if (groupBy === 'operator') {
        const operator = (cost as any).operators;
        key = operator?.name || 'Sin operador asignado';
      } else if (groupBy === 'service_folio') {
        const hasService = !!cost.service_id;
        const hasSupplier = !!cost.supplier_id;
        const hasFolio = !!cost.service_folio;

        if (hasService && hasFolio) {
          // Costo vinculado a un servicio real
          key = `Servicio ${cost.service_folio}`;
        } else if (hasService && !hasFolio) {
          // Vinculado a servicio pero sin folio registrado
          key = 'Servicio sin folio';
        } else if (!hasService && hasFolio && hasSupplier) {
          // Compra de proveedor externo: service_folio es el folio del DTE
          key = `Compra (Doc. ${cost.service_folio})`;
        } else if (!hasService && !hasFolio && hasSupplier) {
          // Compra de proveedor sin folio de documento
          const supplier = (cost as any).inventory_suppliers;
          key = supplier?.name
            ? `Compra — ${supplier.name}`
            : 'Compra sin documento';
        } else {
          // Sin servicio, sin proveedor externo → gasto propio G5N
          key = 'Gastos propios G5N';
        }
      } else if (groupBy === 'supplier') {
        const supplier = (cost as any).inventory_suppliers;
        key = supplier?.name || 'Sin proveedor';
      } else if (groupBy === 'payment_status') {
        key = (cost as any).payment_date ? 'Pagado' : 'Pendiente de pago';
      } else {
        key = getCategoryDisplay(cost);
      }
      
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(cost);
    });

    return groups;
  }, [sortedCosts, groupBy, getCategoryDisplay]);

  // Paginación
  const paginatedGroups = useMemo(() => {
    if (groupBy !== 'none') {
      return groupedCosts; // No paginar cuando hay agrupación
    }

    // Server-side: los costs ya vienen paginados, no rebanar
    if (isServerPaged) {
      return { 'all': sortedCosts };
    }

    const startIndex = (effectivePage - 1) * effectivePageSize;
    const endIndex = startIndex + effectivePageSize;
    return { 'all': sortedCosts.slice(startIndex, endIndex) };
  }, [groupedCosts, effectivePage, effectivePageSize, groupBy, sortedCosts, isServerPaged]);

  const totalCount = isServerPaged ? (serverTotal ?? 0) : costs.length;
  const totalPages = groupBy !== 'none' ? 1 : Math.ceil(totalCount / effectivePageSize);

  const toggleGroup = (groupKey: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupKey)) {
      newExpanded.delete(groupKey);
    } else {
      newExpanded.add(groupKey);
    }
    setExpandedGroups(newExpanded);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="ml-2 size-4" />;
    return sortDirection === 'asc' ? 
      <ArrowUp className="ml-2 size-4" /> : 
      <ArrowDown className="ml-2 size-4" />;
  };

  const calculateTotals = () => {
    return costs.reduce((acc, cost) => acc + Number(cost.amount), 0);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return format(new Date(`${date}T12:00:00Z`), 'dd/MM/yyyy');
  };

  if (loading) {
    return (
      <Card className="bg-background">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-full"></div>
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const renderCostRow = (cost: Cost) => (
    <TableRow 
      key={cost.id} 
      className={cn(
        'group border-border/60 hover:bg-accent/20',
        highlightedCostId === cost.id && 'border-l-4 border-primary bg-primary/5'
      )}
    >
      {onSelectionChange && (
        <TableCell className="w-12">
          <Checkbox
            checked={selectedCosts.has(cost.id)}
            onCheckedChange={(checked) => handleSelectOne(cost.id, checked as boolean)}
            aria-label={`Seleccionar ${cost.description}`}
          />
        </TableCell>
      )}
      <TableCell className="font-medium">
        {formatDate(cost.date)}
      </TableCell>
      <TableCell className="font-medium text-foreground">
        {cost.payment_date ? (
          formatDate(cost.payment_date)
        ) : (
          <span className="text-muted-foreground">N/A</span>
        )}
      </TableCell>
      <TableCell className="max-w-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate" title={cost.description}>
              {cost.description}
            </span>
            {(() => {
              const itemsCount = (cost as any).supplier_invoices?.supplier_invoice_items?.length || 0;
              return itemsCount > 1 ? (
                <Badge variant="outline" className="shrink-0 border-warning/20 bg-warning/10 px-1.5 py-0 text-xs text-warning">
                  <Layers className="mr-0.5 size-3" />
                  {itemsCount}
                </Badge>
              ) : null;
            })()}
          </div>
          <div className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {getCostShortId(cost.id)}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="secondary" className="bg-primary/10 text-primary">
          {getCategoryDisplay(cost)}
        </Badge>
      </TableCell>
      <TableCell>
        {cost.subcategory && (
          <Badge variant="outline" className="text-xs">
            {getSubcategoryDisplay(cost.subcategory)}
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-right font-semibold text-foreground">
        {formatCurrency(Number(cost.amount))}
      </TableCell>
      <TableCell className="text-center">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                {cost.payment_date ? (
                  new Date(`${cost.payment_date}T12:00:00Z`) > businessClock.now() ? (
                    <CalendarClock className="mx-auto size-5 text-warning" />
                  ) : (
                    <CheckCircle className="mx-auto size-5 text-success" />
                  )
                ) : (
                  <Circle className="mx-auto size-5 text-danger" />
                )}
              </span>
              </TooltipTrigger>
              <TooltipContent>
                {cost.payment_date
                  ? new Date(`${cost.payment_date}T12:00:00Z`) > businessClock.todayDate()
                    ? `Pago programado - ${format(new Date(`${cost.payment_date}T12:00:00Z`), 'dd/MM/yyyy')}`
                  : 'Pagado'
                : 'Pendiente'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {cost.services ? (
          <button
            onClick={() => handleServiceClick(cost)}
            className="cursor-pointer text-primary underline underline-offset-2 hover:text-primary/80"
          >
            {getAssociatedTo(cost)}
          </button>
        ) : (
          getAssociatedTo(cost)
        )}
      </TableCell>
      {/* Acciones rápidas inline */}
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8" onClick={() => onViewDetails(cost)}>
                  <Eye className="size-4 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Ver detalles</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8" onClick={() => onEdit(cost)}>
                  <Edit className="size-4 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Editar</TooltipContent>
            </Tooltip>
            
            {onDuplicate && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => onDuplicate(cost)}>
                    <Copy className="size-4 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Duplicar</TooltipContent>
              </Tooltip>
            )}
          </TooltipProvider>
          
          {/* Menú para acciones secundarias */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <MoreHorizontal className="size-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                onClick={() => onDelete(cost)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 size-4" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  );

  const groupEntries = Object.entries(paginatedGroups);

  // Para agrupaciones que no sean 'none' o 'date', ordenar las claves alfabéticamente
  // poniendo los grupos "Sin X" siempre al final
  if (groupBy !== 'none' && groupBy !== 'date') {
    groupEntries.sort(([a], [b]) => {
      const aIsEmpty = a.startsWith('Sin ');
      const bIsEmpty = b.startsWith('Sin ');
      if (aIsEmpty && !bIsEmpty) return 1;
      if (!aIsEmpty && bIsEmpty) return -1;
      return a.localeCompare(b, 'es');
    });
  }

  return (
    <div className="space-y-4">
      {/* Barra de acciones por lotes */}
      {selectedCosts.size > 0 && onBatchUpdate && (
        <CostBatchActionBar
          selectedCount={selectedCosts.size}
          totalAmount={calculateSelectedTotal()}
          onBatchUpdate={onBatchUpdate}
          onBatchMarkPaid={onBatchMarkPaid}
          onBatchDelete={onBatchDelete}
          onClearSelection={() => onSelectionChange?.(new Set())}
        />
      )}

      {/* Controles de agrupación y paginación */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="size-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Agrupar por:</span>
          <Select value={groupBy} onValueChange={(v: GroupBy) => setGroupBy(v)}>
            <SelectTrigger className="w-36 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin agrupar</SelectItem>
              <SelectItem value="date">Fecha</SelectItem>
              <SelectItem value="category">Categoría</SelectItem>
              <SelectItem value="crane">Grúa</SelectItem>
              <SelectItem value="operator">Operador</SelectItem>
              <SelectItem value="service_folio">Folio Servicio</SelectItem>
              <SelectItem value="supplier">Proveedor</SelectItem>
              <SelectItem value="payment_status">Estado de Pago</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {groupBy === 'none' && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Mostrar:</span>
            <Select 
              value={String(effectivePageSize)} 
              onValueChange={(v) => handlePageSizeChange(Number(v))}
            >
              <SelectTrigger className="w-20 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ITEMS_PER_PAGE_OPTIONS.map(n => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <Card className="bg-background">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[58.75rem]">
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  {onSelectionChange && (
                    <TableHead className="w-12 pl-6">
                      <Checkbox
                        checked={selectedCosts.size === costs.length && costs.length > 0}
                        onCheckedChange={handleSelectAll}
                        aria-label="Seleccionar todos"
                      />
                    </TableHead>
                  )}
                  <TableHead className="cursor-pointer font-semibold text-foreground" onClick={() => handleSort('date')}>
                    <div className="flex items-center">
                      Fecha
                      <SortIcon field="date" />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer font-semibold text-foreground" onClick={() => handleSort('payment_date')}>
                    <div className="flex items-center">
                      Fecha de Pago
                      <SortIcon field="payment_date" />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer font-semibold text-foreground" onClick={() => handleSort('description')}>
                    <div className="flex items-center">
                      Descripción
                      <SortIcon field="description" />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer font-semibold text-foreground" onClick={() => handleSort('category')}>
                    <div className="flex items-center">
                      Categoría
                      <SortIcon field="category" />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer font-semibold text-foreground" onClick={() => handleSort('subcategory')}>
                    <div className="flex items-center">
                      Subcategoría
                      <SortIcon field="subcategory" />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer text-right font-semibold text-foreground" onClick={() => handleSort('amount')}>
                    <div className="flex items-center justify-end">
                      Monto
                      <SortIcon field="amount" />
                    </div>
                  </TableHead>
                  <TableHead className="w-20 text-center font-semibold text-foreground">Pagado</TableHead>
                  <TableHead className="cursor-pointer font-semibold text-foreground" onClick={() => handleSort('associated')}>
                    <div className="flex items-center">
                      Asociado a
                      <SortIcon field="associated" />
                    </div>
                  </TableHead>
                  <TableHead className="w-32 pr-6 text-right font-semibold text-foreground">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupEntries.map(([groupKey, groupCosts]) => {
                  if (groupBy === 'none') {
                    return groupCosts.length === 0 ? (
                      <TableRow key="empty">
                        <TableCell colSpan={onSelectionChange ? 10 : 9} className="py-8 text-center text-muted-foreground">
                          No se encontraron costos que coincidan con los filtros aplicados.
                        </TableCell>
                      </TableRow>
                    ) : (
                      groupCosts.map(cost => renderCostRow(cost))
                    );
                  }

                  const groupTotal = groupCosts.reduce((sum, c) => sum + Number(c.amount), 0);
                  const isExpanded = expandedGroups.has(groupKey);

                  return (
                    <Fragment key={groupKey}>
                      <TableRow 
                        className="cursor-pointer bg-muted/30 hover:bg-muted/50"
                        onClick={() => toggleGroup(groupKey)}
                      >
                        <TableCell colSpan={onSelectionChange ? 10 : 9}>
                          <div className="flex items-center justify-between py-1">
                            <div className="flex min-w-0 flex-1 items-center gap-2 flex-wrap">
                              <span className={cn(
                                'transform transition-transform flex-shrink-0',
                                isExpanded ? 'rotate-90' : ''
                              )}>
                                ▶
                              </span>
                              <span className="font-medium capitalize truncate min-w-0 flex-1">{groupKey}</span>
                              <Badge variant="secondary" className="flex-shrink-0">{groupCosts.length} costos</Badge>
                            </div>
                            <span className="font-semibold text-primary flex-shrink-0 pl-2">
                              {formatCurrency(groupTotal)}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && groupCosts.map(cost => renderCostRow(cost))}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Indicador de búsqueda activa (sin paginación server-side) */}
      {disableServerPagination && serverTotal !== undefined && (
        <div className="flex items-center justify-center">
          <Badge variant="outline" className="text-xs text-muted-foreground">
            {serverTotal >= 500
              ? `Mostrando los primeros 500 resultados — refine la búsqueda`
              : `${serverTotal} resultado${serverTotal !== 1 ? 's' : ''} encontrado${serverTotal !== 1 ? 's' : ''}`}
          </Badge>
        </div>
      )}

      {/* Paginación */}
      {groupBy === 'none' && totalPages > 1 && !disableServerPagination && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {((effectivePage - 1) * effectivePageSize) + 1} - {Math.min(effectivePage * effectivePageSize, totalCount)} de {totalCount}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(Math.max(1, effectivePage - 1))}
              disabled={effectivePage === 1}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-sm text-foreground">
              Página {effectivePage} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(Math.min(totalPages, effectivePage + 1))}
              disabled={effectivePage === totalPages}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Totales */}
      {costs.length > 0 && (
        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardContent className="p-4">
            <div className="flex justify-between items-center flex-wrap gap-4">
              <div className="flex gap-x-6">
                <div>
                  <span className="text-sm text-muted-foreground">Total registros:</span>
                  <span className="ml-2 font-semibold text-foreground">{costs.length}</span>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Total monto:</span>
                  <span className="ml-2 font-semibold text-primary">
                    {formatCurrency(calculateTotals())}
                  </span>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Promedio:</span>
                  <span className="ml-2 font-semibold text-foreground">
                    {formatCurrency(costs.length > 0 ? calculateTotals() / costs.length : 0)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal de detalles del servicio */}
      {selectedServiceId && serviceDetails && (
        <ServiceDetailsModal
          service={serviceDetails}
          isOpen={isServiceModalOpen}
          onClose={() => {
            setIsServiceModalOpen(false);
            setSelectedServiceId(null);
          }}
        />
      )}
    </div>
  );
};
