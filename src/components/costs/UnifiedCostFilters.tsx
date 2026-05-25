import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import DatePickerInput from '@/components/common/DatePickerInput';
import { Filter, X, Clock, CalendarDays, Calendar, CalendarCheck } from 'lucide-react';
import { useCostCategories } from '@/hooks/useCostCategories';
import { useCostSubcategories } from '@/hooks/useCostSubcategories';
import { useOperatorsData } from '@/hooks/operators/useOperatorsData';
import { useCranes } from '@/hooks/useCranes';
import { CostFilters } from './CostFilters';
import { cn } from '@/lib/utils';

import { toLocalDateString } from '@/utils/timezoneUtils';

interface UnifiedCostFiltersProps {
  filters: CostFilters;
  onFiltersChange: (filters: CostFilters) => void;
  onClearFilters: () => void;
  dateFilter: string;
  onDateFilterChange: (filter: string) => void;
  totalResults: number;
  totalCosts: number;
  todayCount?: number;
}

const dateFilterOptions = [
  { key: 'today', label: 'Hoy', icon: Clock },
  { key: 'week', label: 'Semana', icon: CalendarDays },
  { key: 'month', label: 'Mes', icon: Calendar },
  { key: 'all', label: 'Todos', icon: CalendarCheck },
];

export const UnifiedCostFilters = ({
  filters,
  onFiltersChange,
  onClearFilters,
  dateFilter,
  onDateFilterChange,
  totalResults,
  totalCosts,
  todayCount = 0,
}: UnifiedCostFiltersProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { data: categories = [] } = useCostCategories();
  const { data: operators = [] } = useOperatorsData();
  const { cranes } = useCranes();
  
  // Subcategorías dinámicas basadas en la categoría seleccionada
  const { subcategories } = useCostSubcategories(
    filters.category !== 'all' ? filters.category : undefined
  );

  const updateFilter = (key: keyof CostFilters, value: any) => {
    const newFilters = { ...filters, [key]: value };
    // Reset subcategory when category changes
    if (key === 'category') {
      newFilters.subcategory = 'all';
    }
    onFiltersChange(newFilters);
  };

  // Cuenta de filtros activos
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.category && filters.category !== 'all') count++;
    if (filters.subcategory && filters.subcategory !== 'all') count++;
    if (filters.dateFrom) count++;
    if (filters.dateTo) count++;
    if (filters.operatorId && filters.operatorId !== 'all') count++;
    if (filters.craneId && filters.craneId !== 'all') count++;
    if (filters.minAmount) count++;
    if (filters.maxAmount) count++;
    return count;
  }, [filters]);

  const handleClearAll = () => {
    onClearFilters();
    onDateFilterChange('all');
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border shadow-sm">
      {/* Filtros rápidos de período */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <Label className="text-sm font-medium text-muted-foreground">Período</Label>
          {dateFilter !== 'all' && (
            <Badge variant="secondary" className="text-xs">
              Filtro activo
            </Badge>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {dateFilterOptions.map((option) => {
            const Icon = option.icon;
            const isActive = dateFilter === option.key;
            return (
              <Button
                key={option.key}
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                onClick={() => onDateFilterChange(option.key)}
                className={cn(
                  'transition-all',
                  isActive && 'bg-violet-600 hover:bg-violet-700 text-white'
                )}
              >
                <Icon className="size-4 mr-1.5" />
                {option.label}
                {option.key === 'today' && todayCount > 0 && (
                  <Badge
                    variant="secondary"
                    className={cn(
                      'ml-1.5 px-1.5 py-0 text-xs',
                      isActive && 'bg-white/20 text-white'
                    )}
                  >
                    {todayCount}
                  </Badge>
                )}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Filtros avanzados en panel lateral */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="relative">
                <Filter className="size-4 mr-2" />
                Filtros Avanzados
                {activeFilterCount > 0 && (
                  <Badge
                    className="absolute -top-2 -right-2 size-5 p-0 flex items-center justify-center bg-violet-600 text-white text-xs"
                  >
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[320px] sm:w-[400px]">
              <SheetHeader>
                <SheetTitle className="flex items-center justify-between">
                  <span>Filtros Avanzados</span>
                  {activeFilterCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={onClearFilters}>
                      <X className="size-4 mr-1" />
                      Limpiar
                    </Button>
                  )}
                </SheetTitle>
              </SheetHeader>

              <div className="space-y-6 mt-6">
                {/* Categoría */}
                <div className="space-y-2">
                  <Label>Categoría</Label>
                  <Select
                    value={filters.category || 'all'}
                    onValueChange={(value) => updateFilter('category', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todas las categorías" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las categorías</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Subcategoría dinámica */}
                {filters.category && filters.category !== 'all' && subcategories.length > 0 && (
                  <div className="space-y-2">
                    <Label>Subcategoría</Label>
                    <Select
                      value={filters.subcategory || 'all'}
                      onValueChange={(value) => updateFilter('subcategory', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Todas las subcategorías" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas las subcategorías</SelectItem>
                        {subcategories.filter(sub => sub.name && sub.name.trim() !== '').map((sub) => (
                          <SelectItem key={sub.id} value={sub.name}>
                            {sub.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <Separator />

                {/* Rango de fechas personalizado */}
                <div className="space-y-2">
                  <Label>Rango de fechas personalizado</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Desde</Label>
                      <DatePickerInput
                        value={filters.dateFrom ? toLocalDateString(filters.dateFrom) : ''}
                        onChange={(date) => updateFilter('dateFrom', date ? new Date(date) : null)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Hasta</Label>
                      <DatePickerInput
                        value={filters.dateTo ? toLocalDateString(filters.dateTo) : ''}
                        onChange={(date) => updateFilter('dateTo', date ? new Date(date) : null)}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Asociaciones */}
                <div className="space-y-4">
                  <Label className="text-sm font-medium">Asociado a</Label>
                  
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Grúa</Label>
                    <Select
                      value={filters.craneId || 'all'}
                      onValueChange={(value) => updateFilter('craneId', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Todas las grúas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas las grúas</SelectItem>
                        {cranes.map((crane) => (
                          <SelectItem key={crane.id} value={crane.id}>
                            {crane.brand} {crane.model} - {crane.licensePlate}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Operador</Label>
                    <Select
                      value={filters.operatorId || 'all'}
                      onValueChange={(value) => updateFilter('operatorId', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Todos los operadores" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los operadores</SelectItem>
                        {operators.map((op) => (
                          <SelectItem key={op.id} value={op.id}>
                            {op.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                {/* Rango de monto */}
                <div className="space-y-2">
                  <Label>Rango de monto</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Mínimo</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                        <Input
                          type="number"
                          value={filters.minAmount}
                          onChange={(e) => updateFilter('minAmount', e.target.value)}
                          placeholder="0"
                          className="pl-7"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Máximo</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                        <Input
                          type="number"
                          value={filters.maxAmount}
                          onChange={(e) => updateFilter('maxAmount', e.target.value)}
                          placeholder="Sin límite"
                          className="pl-7"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={handleClearAll}>
              <X className="size-4 mr-1" />
              Limpiar todo
            </Button>
          )}
        </div>

        {/* Contador de resultados */}
        <div className="text-sm text-muted-foreground">
          Mostrando <span className="font-medium text-foreground">{totalResults}</span>
          {totalResults !== totalCosts && (
            <span> de <span className="font-medium text-foreground">{totalCosts}</span></span>
          )}
          {' '}costos
        </div>
      </div>
    </div>
  );
};
