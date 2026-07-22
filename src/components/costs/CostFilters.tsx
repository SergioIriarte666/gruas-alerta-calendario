import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Filter, X, CalendarIcon } from 'lucide-react';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useCostCategories } from '@/hooks/useCostCategories';
import { useOperators } from '@/hooks/useOperators';
import { useCranes } from '@/hooks/useCranes';
import { safeParseDateOnly, toLocalDateString } from '@/utils/timezoneUtils';
import { EntityKey } from '@/lib/entities';
import { OperatorSelectLabel } from '@/components/operators/OperatorAppAccessBadge';

export interface CostFilters {
  category: string;
  subcategory: string;
  dateFrom: string; // 'YYYY-MM-DD' o '' (sin filtro)
  dateTo: string;   // 'YYYY-MM-DD' o '' (sin filtro)
  operatorId: string;
  craneId: string;
  serviceId: string;
  minAmount: string;
  maxAmount: string;
  costCenterId: string;
  /** 'all' muestra ambas entidades; por defecto la página parte en 'gruas_5_norte'. */
  entity: EntityKey | 'all';
}

interface CostFiltersProps {
  filters: CostFilters;
  onFiltersChange: (filters: CostFilters) => void;
  onClearFilters: () => void;
}

export const CostFiltersComponent = ({ filters, onFiltersChange, onClearFilters }: CostFiltersProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { data: categories = [] } = useCostCategories();
  const { operators = [] } = useOperators();
  const { cranes = [] } = useCranes();

  const updateFilter = (key: keyof CostFilters, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const hasActiveFilters = Object.values(filters).some(value => 
    value !== null && value !== '' && value !== undefined
  );

  const subcategories = ['Combustible', 'Peajes', 'Otros'];

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="relative">
          <Filter className="size-4 mr-2" />
          Filtros
          {hasActiveFilters && (
            <span className="absolute -right-1 -top-1 size-2 rounded-full bg-danger" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="max-h-[80vh] w-80 max-w-[90vw] overflow-y-auto border-border bg-card" align="end" side="bottom" sideOffset={8}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-foreground">Filtros Avanzados</h3>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={onClearFilters}>
                <X className="size-4 mr-1" />
                Limpiar
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Categoría */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Categoría</Label>
              <Select value={filters.category} onValueChange={(value) => updateFilter('category', value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subcategoría */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Subcategoría</Label>
              <Select value={filters.subcategory} onValueChange={(value) => updateFilter('subcategory', value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {subcategories.filter(sub => sub && sub.trim() !== '').map((sub) => (
                    <SelectItem key={sub} value={sub}>
                      {sub}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Rango de fechas */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Rango de fechas</Label>
            <div className="grid grid-cols-2 gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 size-4" />
                    {filters.dateFrom ? format(safeParseDateOnly(filters.dateFrom), 'dd/MM/yyyy', { locale: es }) : 'Desde'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={filters.dateFrom ? safeParseDateOnly(filters.dateFrom) : undefined}
                    onSelect={(date) => updateFilter('dateFrom', date ? toLocalDateString(date) : '')}
                    locale={es}
                  />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 size-4" />
                    {filters.dateTo ? format(safeParseDateOnly(filters.dateTo), 'dd/MM/yyyy', { locale: es }) : 'Hasta'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={filters.dateTo ? safeParseDateOnly(filters.dateTo) : undefined}
                    onSelect={(date) => updateFilter('dateTo', date ? toLocalDateString(date) : '')}
                    locale={es}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Operador */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Operador</Label>
              <Select value={filters.operatorId} onValueChange={(value) => updateFilter('operatorId', value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {operators.map((operator) => (
                    <SelectItem key={operator.id} value={operator.id}>
                      <OperatorSelectLabel operator={operator} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Grúa */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Grúa</Label>
              <Select value={filters.craneId} onValueChange={(value) => updateFilter('craneId', value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {cranes.map((crane) => (
                    <SelectItem key={crane.id} value={crane.id}>
                      {crane.brand} {crane.model} - {crane.licensePlate}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Rango de monto */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Rango de monto</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                placeholder="Mínimo"
                value={filters.minAmount}
                onChange={(e) => updateFilter('minAmount', e.target.value)}
              />
              <Input
                type="number"
                placeholder="Máximo"
                value={filters.maxAmount}
                onChange={(e) => updateFilter('maxAmount', e.target.value)}
              />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
