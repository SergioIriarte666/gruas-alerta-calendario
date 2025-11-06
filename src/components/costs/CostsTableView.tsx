import React, { useState, useMemo } from 'react';
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Edit, Trash2, Eye, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Cost } from '@/types/costs';
import { Card, CardContent } from '@/components/ui/card';
import { ServiceDetailsModal } from '@/components/services/ServiceDetailsModal';
import { useServiceDetails } from '@/hooks/useServiceDetails';
import { useSupplierCategoryManager } from '@/hooks/useSupplierCategoryManager';
import { getCategoryLabel } from '@/utils/categoryUtils';
import { CostBatchActionBar } from './CostBatchActionBar';

interface CostsTableViewProps {
  costs: Cost[];
  onEdit: (cost: Cost) => void;
  onDelete: (cost: Cost) => void;
  onViewDetails: (cost: Cost) => void;
  loading?: boolean;
  highlightedCostId?: string;
  selectedCosts?: Set<string>;
  onSelectionChange?: (selected: Set<string>) => void;
  onBatchUpdate?: () => void;
}

type SortField = 'date' | 'description' | 'category' | 'subcategory' | 'amount' | 'associated';
type SortDirection = 'asc' | 'desc';

export const CostsTableView = ({ 
  costs, 
  onEdit, 
  onDelete, 
  onViewDetails, 
  loading, 
  highlightedCostId,
  selectedCosts = new Set<string>(),
  onSelectionChange,
  onBatchUpdate 
}: CostsTableViewProps) => {
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  
  // Obtener detalles completos del servicio
  const { data: serviceDetails } = useServiceDetails(selectedServiceId);
  
  // Obtener categorías de proveedores para resolver UUIDs
  const { activeCategories } = useSupplierCategoryManager();

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

  const getAssociatedTo = (cost: Cost) => {
    if (cost.services) return `Servicio: ${cost.services.folio}`;
    if (cost.cranes) return `Grúa: ${cost.cranes.brand} ${cost.cranes.model} (${cost.cranes.license_plate})`;
    if (cost.operators) return `Operador: ${cost.operators.name}`;
    return 'N/A';
  };

  const handleServiceClick = (cost: Cost) => {
    if (cost.services) {
      setSelectedServiceId(cost.services.id);
      setIsServiceModalOpen(true);
    }
  };

  // Función para detectar si una cadena es un UUID
  const isUUID = (str: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  };

  // Función para obtener el nombre legible de la subcategoría
  const getSubcategoryDisplay = (subcategory: string) => {
    if (!subcategory) return null;
    
    // Si es un UUID, buscar en las categorías de proveedores
    if (isUUID(subcategory)) {
      return getCategoryLabel(activeCategories || [], subcategory);
    }
    
    // Si no es UUID, mostrar el valor directamente
    return subcategory;
  };

  const getCategoryDisplay = (cost: Cost) => {
    const categoryName = cost.cost_categories?.name || 'Sin categoría';
    if (cost.subcategory && categoryName === 'Gastos de Servicios') {
      return `${categoryName} - ${getSubcategoryDisplay(cost.subcategory)}`;
    }
    return categoryName;
  };

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
  }, [costs, sortField, sortDirection]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="ml-2 h-4 w-4" />;
    return sortDirection === 'asc' ? 
      <ArrowUp className="ml-2 h-4 w-4" /> : 
      <ArrowDown className="ml-2 h-4 w-4" />;
  };

  const calculateTotals = () => {
    return costs.reduce((acc, cost) => acc + Number(cost.amount), 0);
  };

  if (loading) {
    return (
      <Card className="bg-white dark:bg-gray-800">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Barra de acciones por lotes */}
      {selectedCosts.size > 0 && onBatchUpdate && (
        <CostBatchActionBar
          selectedCount={selectedCosts.size}
          totalAmount={calculateSelectedTotal()}
          onBatchUpdate={onBatchUpdate}
          onClearSelection={() => onSelectionChange?.(new Set())}
        />
      )}

      <Card className="bg-white dark:bg-gray-800">
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
                  <TableHead className="cursor-pointer" onClick={() => handleSort('associated')}>
                    <div className="flex items-center">
                      Asociado a
                      <SortIcon field="associated" />
                    </div>
                  </TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedCosts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={onSelectionChange ? 8 : 7} className="text-center text-gray-500 py-8">
                      No se encontraron costos que coincidan con los filtros aplicados.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedCosts.map((cost) => (
                    <TableRow 
                      key={cost.id} 
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${
                        highlightedCostId === cost.id 
                          ? 'bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500' 
                          : ''
                      }`}
                    >
                      {onSelectionChange && (
                        <TableCell>
                          <Checkbox
                            checked={selectedCosts.has(cost.id)}
                            onCheckedChange={(checked) => handleSelectOne(cost.id, checked as boolean)}
                            aria-label={`Seleccionar ${cost.description}`}
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-medium">
                        {new Date(cost.date + 'T00:00:00').toLocaleDateString('es-ES')}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="truncate" title={cost.description}>
                          {cost.description}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          {cost.cost_categories?.name || 'Sin categoría'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {cost.subcategory && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                            {getSubcategoryDisplay(cost.subcategory)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${Number(cost.amount).toLocaleString('es-CL')}
                      </TableCell>
                      <TableCell className="text-gray-600 dark:text-gray-400 text-sm">
                        {cost.services ? (
                          <button
                            onClick={() => handleServiceClick(cost)}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline cursor-pointer"
                          >
                            {getAssociatedTo(cost)}
                          </button>
                        ) : (
                          getAssociatedTo(cost)
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Abrir menú</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onViewDetails(cost)}>
                              <Eye className="mr-2 h-4 w-4" />
                              Ver Detalles
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onEdit(cost)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => onDelete(cost)}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Eliminar
                            </DropdownMenuItem>
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

      {/* Totales */}
      {costs.length > 0 && (
        <Card className="bg-gray-50 dark:bg-gray-800">
          <CardContent className="p-4">
            <div className="flex justify-between items-center">
              <div className="flex space-x-6">
                <div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Total registros:</span>
                  <span className="ml-2 font-semibold">{costs.length}</span>
                </div>
                <div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Total monto:</span>
                  <span className="ml-2 font-semibold text-green-600">
                    ${calculateTotals().toLocaleString('es-CL')}
                  </span>
                </div>
                <div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Promedio:</span>
                  <span className="ml-2 font-semibold">
                    ${costs.length > 0 ? (calculateTotals() / costs.length).toLocaleString('es-CL') : '0'}
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