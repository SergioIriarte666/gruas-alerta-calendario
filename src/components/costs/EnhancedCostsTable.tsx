import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Card, CardContent } from '@/components/ui/card';
import { ServiceDetailsModal } from '@/components/services/ServiceDetailsModal';
import { useServiceDetails } from '@/hooks/useServiceDetails';
import { useCostCategories } from '@/hooks/useCostCategories';
import { getCategoryLabel } from '@/utils/categoryUtils';
import { CostBatchActionBar } from './CostBatchActionBar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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
}

type SortField = 'date' | 'description' | 'category' | 'subcategory' | 'amount' | 'associated';
type SortDirection = 'asc' | 'desc';
type GroupBy = 'none' | 'date' | 'category';

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
  onBatchMarkPaid
}: EnhancedCostsTableProps) => {
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['all']));

  // Reset page when costs change (e.g. search/filter)
  useEffect(() => {
    setCurrentPage(1);
  }, [costs]);
  
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
        key = format(new Date(cost.date + 'T00:00:00'), "MMMM yyyy", { locale: es });
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

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return { 'all': sortedCosts.slice(startIndex, endIndex) };
  }, [groupedCosts, currentPage, itemsPerPage, groupBy, sortedCosts]);

  const totalPages = groupBy !== 'none' ? 1 : Math.ceil(costs.length / itemsPerPage);

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
    if (sortField !== field) return <ArrowUpDown className="ml-2 h-4 w-4" />;
    return sortDirection === 'asc' ? 
      <ArrowUp className="ml-2 h-4 w-4" /> : 
      <ArrowDown className="ml-2 h-4 w-4" />;
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
        'hover:bg-muted/50 group',
        highlightedCostId === cost.id && 'bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500'
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
        {format(new Date(cost.date + 'T00:00:00'), 'dd/MM/yyyy')}
      </TableCell>
      <TableCell className="max-w-xs">
        <div className="flex items-center gap-1.5">
          <span className="truncate" title={cost.description}>
            {cost.description}
          </span>
          {(() => {
            const itemsCount = (cost as any).supplier_invoices?.supplier_invoice_items?.length || 0;
            return itemsCount > 1 ? (
              <Badge variant="outline" className="shrink-0 text-[10px] px-1.5 py-0 border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-600 dark:bg-amber-900/30 dark:text-amber-300">
                <Layers className="h-3 w-3 mr-0.5" />
                {itemsCount}
              </Badge>
            ) : null;
          })()}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="secondary" className="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
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
                  new Date(cost.payment_date + 'T00:00:00') > new Date() ? (
                    <CalendarClock className="h-5 w-5 text-amber-500" />
                  ) : (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  )
                ) : (
                  <Circle className="h-5 w-5 text-red-400" />
                )}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {cost.payment_date
                ? new Date(cost.payment_date + 'T00:00:00') > new Date()
                  ? `Pago programado - ${format(new Date(cost.payment_date + 'T00:00:00'), 'dd/MM/yyyy')}`
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
            className="text-violet-600 hover:text-violet-800 dark:text-violet-400 dark:hover:text-violet-300 underline cursor-pointer"
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
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onViewDetails(cost)}>
                  <Eye className="h-4 w-4 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Ver detalles</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(cost)}>
                  <Edit className="h-4 w-4 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Editar</TooltipContent>
            </Tooltip>
            
            {onDuplicate && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDuplicate(cost)}>
                    <Copy className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Duplicar</TooltipContent>
              </Tooltip>
            )}
          </TooltipProvider>
          
          {/* Menú para acciones secundarias */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                onClick={() => onDelete(cost)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  );

  return (
    <div className="space-y-4">
      {/* Barra de acciones por lotes */}
      {selectedCosts.size > 0 && onBatchUpdate && (
        <CostBatchActionBar
          selectedCount={selectedCosts.size}
          totalAmount={calculateSelectedTotal()}
          onBatchUpdate={onBatchUpdate}
          onBatchMarkPaid={onBatchMarkPaid}
          onClearSelection={() => onSelectionChange?.(new Set())}
        />
      )}

      {/* Controles de agrupación y paginación */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Agrupar por:</span>
          <Select value={groupBy} onValueChange={(v: GroupBy) => setGroupBy(v)}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin agrupar</SelectItem>
              <SelectItem value="date">Fecha</SelectItem>
              <SelectItem value="category">Categoría</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {groupBy === 'none' && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Mostrar:</span>
            <Select 
              value={String(itemsPerPage)} 
              onValueChange={(v) => {
                setItemsPerPage(Number(v));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[80px] h-9">
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
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {onSelectionChange && (
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedCosts.size === costs.length && costs.length > 0}
                        onCheckedChange={handleSelectAll}
                        aria-label="Seleccionar todos"
                      />
                    </TableHead>
                  )}
                  <TableHead className="cursor-pointer" onClick={() => handleSort('date')}>
                    <div className="flex items-center">
                      Fecha
                      <SortIcon field="date" />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('description')}>
                    <div className="flex items-center">
                      Descripción
                      <SortIcon field="description" />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('category')}>
                    <div className="flex items-center">
                      Categoría
                      <SortIcon field="category" />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('subcategory')}>
                    <div className="flex items-center">
                      Subcategoría
                      <SortIcon field="subcategory" />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => handleSort('amount')}>
                    <div className="flex items-center justify-end">
                      Monto
                      <SortIcon field="amount" />
                    </div>
                  </TableHead>
                  <TableHead className="text-center w-20">Pagado</TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('associated')}>
                    <div className="flex items-center">
                      Asociado a
                      <SortIcon field="associated" />
                    </div>
                  </TableHead>
                  <TableHead className="text-right w-32">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(paginatedGroups).map(([groupKey, groupCosts]) => {
                  if (groupBy === 'none') {
                    return groupCosts.length === 0 ? (
                      <TableRow key="empty">
                        <TableCell colSpan={onSelectionChange ? 9 : 8} className="text-center text-muted-foreground py-8">
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
                    <React.Fragment key={groupKey}>
                      <TableRow 
                        className="bg-muted/30 cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleGroup(groupKey)}
                      >
                        <TableCell colSpan={onSelectionChange ? 9 : 8}>
                          <div className="flex items-center justify-between py-1">
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                'transform transition-transform',
                                isExpanded ? 'rotate-90' : ''
                              )}>
                                ▶
                              </span>
                              <span className="font-medium capitalize">{groupKey}</span>
                              <Badge variant="secondary">{groupCosts.length} costos</Badge>
                            </div>
                            <span className="font-semibold text-violet-600">
                              {formatCurrency(groupTotal)}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && groupCosts.map(cost => renderCostRow(cost))}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Paginación */}
      {groupBy === 'none' && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, costs.length)} de {costs.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-foreground">
              Página {currentPage} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Totales */}
      {costs.length > 0 && (
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="flex justify-between items-center flex-wrap gap-4">
              <div className="flex space-x-6">
                <div>
                  <span className="text-sm text-muted-foreground">Total registros:</span>
                  <span className="ml-2 font-semibold text-foreground">{costs.length}</span>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Total monto:</span>
                  <span className="ml-2 font-semibold text-violet-600">
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
