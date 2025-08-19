import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { InventoryReportFilters } from '@/hooks/useInventoryReports';
import { useInventoryCategories } from '@/hooks/useInventory';
import { useCranes } from '@/hooks/useCranes';
import { useOperatorsData } from '@/hooks/operators/useOperatorsData';

interface ReportFiltersProps {
  filters: InventoryReportFilters;
  onFiltersChange: (filters: InventoryReportFilters) => void;
}

export const ReportFilters: React.FC<ReportFiltersProps> = ({
  filters,
  onFiltersChange
}) => {
  const { data: categories } = useInventoryCategories();
  const { cranes } = useCranes();
  const { data: operators } = useOperatorsData();

  const handleFilterChange = (key: keyof InventoryReportFilters, value: string | undefined) => {
    onFiltersChange({
      ...filters,
      [key]: value === "all" ? undefined : value || undefined
    });
  };

  const clearFilters = () => {
    onFiltersChange({});
  };

  const hasActiveFilters = Object.values(filters).some(value => value !== undefined && value !== '');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {/* Date From */}
        <div className="space-y-2">
          <Label>Fecha Desde</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !filters.dateFrom && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.dateFrom ? (
                  format(new Date(filters.dateFrom), "dd/MM/yyyy")
                ) : (
                  <span>Seleccionar fecha</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filters.dateFrom ? new Date(filters.dateFrom) : undefined}
                onSelect={(date) => 
                  handleFilterChange('dateFrom', date ? format(date, 'yyyy-MM-dd') : undefined)
                }
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Date To */}
        <div className="space-y-2">
          <Label>Fecha Hasta</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !filters.dateTo && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.dateTo ? (
                  format(new Date(filters.dateTo), "dd/MM/yyyy")
                ) : (
                  <span>Seleccionar fecha</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filters.dateTo ? new Date(filters.dateTo) : undefined}
                onSelect={(date) => 
                  handleFilterChange('dateTo', date ? format(date, 'yyyy-MM-dd') : undefined)
                }
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Category */}
        <div className="space-y-2">
          <Label>Categoría</Label>
          <Select
            value={filters.categoryId || ''}
            onValueChange={(value) => handleFilterChange('categoryId', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todas las categorías" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {categories?.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Movement Type */}
        <div className="space-y-2">
          <Label>Tipo de Movimiento</Label>
          <Select
            value={filters.movementType || ''}
            onValueChange={(value) => handleFilterChange('movementType', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos los tipos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              <SelectItem value="entry">Entrada</SelectItem>
              <SelectItem value="exit">Salida</SelectItem>
              <SelectItem value="adjustment">Ajuste</SelectItem>
              <SelectItem value="transfer">Transferencia</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Crane */}
        <div className="space-y-2">
          <Label>Grúa</Label>
          <Select
            value={filters.craneId || ''}
            onValueChange={(value) => handleFilterChange('craneId', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todas las grúas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las grúas</SelectItem>
              {cranes?.map((crane) => (
                <SelectItem key={crane.id} value={crane.id}>
                  {crane.licensePlate} - {crane.brand} {crane.model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Operator */}
        <div className="space-y-2">
          <Label>Operador</Label>
          <Select
            value={filters.operatorId || ''}
            onValueChange={(value) => handleFilterChange('operatorId', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos los operadores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los operadores</SelectItem>
              {operators?.map((operator) => (
                <SelectItem key={operator.id} value={operator.id}>
                  {operator.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={clearFilters}
            className="flex items-center gap-2"
          >
            <X className="h-4 w-4" />
            Limpiar Filtros
          </Button>
        </div>
      )}
    </div>
  );
};