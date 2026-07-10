import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import DatePickerInput from '@/components/common/DatePickerInput';
import { Search, Filter, SlidersHorizontal, X, Clock, CalendarDays, Calendar, CalendarCheck, Table2, LayoutGrid, Download } from 'lucide-react';
import { useCostCategories } from '@/hooks/useCostCategories';
import { useCostSubcategories } from '@/hooks/useCostSubcategories';
import { useOperatorsData } from '@/hooks/operators/useOperatorsData';
import { useCranes } from '@/hooks/useCranes';
import { useCostCenters } from '@/hooks/useCostCenters';
import { CostFilters } from './CostFilters';
import { cn } from '@/lib/utils';
import { ENTITIES } from '@/lib/entities';

import { safeDateToDisplay, CostPeriod } from '@/utils/timezoneUtils';

interface UnifiedCostFiltersProps {
  filters: CostFilters;
  onFiltersChange: (filters: CostFilters) => void;
  onClearFilters: () => void;
  dateFilter: CostPeriod;
  onDateFilterChange: (filter: CostPeriod) => void;
  totalResults: number;
  totalCosts: number;
  todayCount?: number;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  viewMode: 'table' | 'cards';
  onViewModeChange: (mode: 'table' | 'cards') => void;
  onExport: () => void;
  isMobile?: boolean;
}

const dateFilterOptions: { key: CostPeriod; label: string; icon: typeof Clock }[] = [
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
  searchTerm,
  onSearchChange,
  viewMode,
  onViewModeChange,
  onExport,
  isMobile = false,
}: UnifiedCostFiltersProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { data: categories = [] } = useCostCategories();
  const { data: operators = [] } = useOperatorsData();
  const { cranes } = useCranes();
  const { data: costCenters = [] } = useCostCenters();
  
  // Subcategorías dinámicas basadas en la categoría seleccionada
  const { subcategories } = useCostSubcategories(
    filters.category !== 'all' ? filters.category : undefined
  );

  // Las fechas son strings 'YYYY-MM-DD': la comparación lexicográfica es válida
  const isDateRangeInvalid = Boolean(
    filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo
  );

  const updateFilter = (key: keyof CostFilters, value: any) => {
    const newFilters = { ...filters, [key]: value };
    // Reset subcategory when category changes
    if (key === 'category') {
      newFilters.subcategory = 'all';
    }
    onFiltersChange(newFilters);
  };

  // Cuenta de filtros activos ("entity" no cuenta: su default es 'gruas_5_norte',
  // no 'all', así que no es un filtro "extra" que el usuario haya agregado)
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

  const activeFilterChips = useMemo(() => {
    const chips: string[] = [];

    if (filters.category && filters.category !== 'all') {
      const categoryName = categories.find(cat => cat.id === filters.category)?.name || 'Categoría';
      chips.push(`Categoría: ${categoryName}`);
    }
    if (filters.subcategory && filters.subcategory !== 'all') {
      chips.push(`Subcategoría: ${filters.subcategory}`);
    }
    if (filters.dateFrom) {
      chips.push(`Desde: ${safeDateToDisplay(filters.dateFrom)}`);
    }
    if (filters.dateTo) {
      chips.push(`Hasta: ${safeDateToDisplay(filters.dateTo)}`);
    }
    if (filters.craneId && filters.craneId !== 'all') {
      const craneLabel = cranes.find(crane => crane.id === filters.craneId);
      chips.push(`Grúa: ${craneLabel ? `${craneLabel.brand} ${craneLabel.model}` : 'Seleccionada'}`);
    }
    if (filters.operatorId && filters.operatorId !== 'all') {
      const operatorLabel = operators.find(op => op.id === filters.operatorId)?.name || 'Operador';
      chips.push(`Operador: ${operatorLabel}`);
    }
    if (filters.costCenterId && filters.costCenterId !== 'all') {
      const costCenterLabel = costCenters.find(center => center.id === filters.costCenterId);
      chips.push(`Centro: ${costCenterLabel ? `${costCenterLabel.code} - ${costCenterLabel.name}` : 'Seleccionado'}`);
    }
    if (filters.minAmount) {
      chips.push(`Min: $${Number(filters.minAmount).toLocaleString('es-CL')}`);
    }
    if (filters.maxAmount) {
      chips.push(`Max: $${Number(filters.maxAmount).toLocaleString('es-CL')}`);
    }

    return chips;
  }, [categories, costCenters, cranes, filters, operators]);

  return (
    <div className="rounded-2xl border border-border/70 bg-card/80 shadow-sm backdrop-blur-sm">
      {/* Filtros rápidos de período */}
      <div className="border-b border-border/60 p-4">
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
                  'rounded-xl transition-all',
                  isActive && 'bg-primary hover:bg-primary/90 text-primary-foreground'
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

      <div className="space-y-4 p-4">
        <div className={cn('flex gap-3', isMobile ? 'flex-col' : 'items-center')}>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar por descripción, categoría, folio, ID corto, notas o mantenimiento..."
              className="h-11 rounded-xl border-border/70 bg-background/70 pl-10"
            />
          </div>

          <div className={cn('flex gap-2', isMobile ? 'flex-wrap' : 'items-center')}>
            <Select
              value={filters.entity}
              onValueChange={(value) => updateFilter('entity', value as CostFilters['entity'])}
            >
              <SelectTrigger className="h-11 w-[180px] rounded-xl border-border/70 bg-background/70">
                <SelectValue placeholder="Empresa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las empresas</SelectItem>
                <SelectItem value={ENTITIES.GRUAS_5_NORTE.key}>{ENTITIES.GRUAS_5_NORTE.label}</SelectItem>
                <SelectItem value={ENTITIES.LOWBOY.key}>{ENTITIES.LOWBOY.label}</SelectItem>
              </SelectContent>
            </Select>

            {!isMobile && (
              <div className="flex items-center gap-1 rounded-xl border border-border/70 bg-background/70 p-1">
                <Button
                  variant={viewMode === 'table' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => onViewModeChange('table')}
                  className="rounded-lg"
                >
                  <Table2 className="size-4" />
                </Button>
                <Button
                  variant={viewMode === 'cards' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => onViewModeChange('cards')}
                  className="rounded-lg"
                >
                  <LayoutGrid className="size-4" />
                </Button>
              </div>
            )}

            <Button
              variant={isOpen ? 'default' : 'outline'}
              onClick={() => setIsOpen(prev => !prev)}
              className="relative h-11 rounded-xl"
            >
              {isOpen ? <SlidersHorizontal className="mr-2 size-4" /> : <Filter className="mr-2 size-4" />}
              Filtros avanzados
              {activeFilterCount > 0 && (
                <Badge className="ml-2 bg-primary/15 text-primary hover:bg-primary/15">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>

            <Button variant="outline" onClick={onExport} className="h-11 rounded-xl border-border/70 bg-background/70">
              <Download className="mr-2 size-4" />
              <span className="hidden sm:inline">Exportar</span>
            </Button>
          </div>
        </div>

        <div className={cn('flex gap-3', isMobile ? 'flex-col' : 'items-center justify-between')}>
          <div className="flex flex-wrap items-center gap-2">
            {searchTerm && (
              <Badge variant="secondary" className="rounded-full px-3 py-1">
                Búsqueda: {searchTerm}
              </Badge>
            )}
            {activeFilterChips.map((chip) => (
              <Badge key={chip} variant="secondary" className="rounded-full px-3 py-1">
                {chip}
              </Badge>
            ))}
            {(activeFilterCount > 0 || searchTerm) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  handleClearAll();
                  onSearchChange('');
                }}
                className="rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="mr-1 size-4" />
                Limpiar todo
              </Button>
            )}
          </div>

          <div className="text-sm text-muted-foreground">
            Mostrando <span className="font-medium text-foreground">{totalResults}</span>
            {totalResults !== totalCosts && (
              <span> de <span className="font-medium text-foreground">{totalCosts}</span></span>
            )}
            {' '}costos
          </div>
        </div>

        {isOpen && (
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Panel de filtros</h3>
                <p className="text-xs text-muted-foreground">
                  Afina la búsqueda por categoría, rango, asociación y centro de costo sin salir de la tabla.
                </p>
              </div>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={handleClearAll}>
                  <X className="mr-1 size-4" />
                  Resetear filtros
                </Button>
              )}
            </div>

            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-3 rounded-xl border border-border/60 bg-background/80 p-4">
                <Label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Clasificación</Label>
                <div className="space-y-3">
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
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-border/60 bg-background/80 p-4">
                <Label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Tiempo</Label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="min-w-0 space-y-2">
                    <Label className="text-xs text-muted-foreground">Desde</Label>
                    <DatePickerInput
                      value={filters.dateFrom}
                      onChange={(date) => updateFilter('dateFrom', date)}
                      className={cn(isDateRangeInvalid && 'border-destructive')}
                    />
                  </div>
                  <div className="min-w-0 space-y-2">
                    <Label className="text-xs text-muted-foreground">Hasta</Label>
                    <DatePickerInput
                      value={filters.dateTo}
                      onChange={(date) => updateFilter('dateTo', date)}
                      className={cn(isDateRangeInvalid && 'border-destructive')}
                    />
                  </div>
                </div>
                {isDateRangeInvalid && (
                  <p className="text-xs text-destructive">
                    "Desde" no puede ser posterior a "Hasta" — el filtro no se aplicará.
                  </p>
                )}
              </div>

              <div className="space-y-3 rounded-xl border border-border/60 bg-background/80 p-4">
                <Label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Asociación</Label>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Grúa</Label>
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
                    <Label>Operador</Label>
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
              </div>

              <div className="space-y-3 rounded-xl border border-border/60 bg-background/80 p-4">
                <Label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Valor y control</Label>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Centro de costo</Label>
                    <Select
                      value={filters.costCenterId || 'all'}
                      onValueChange={(value) => updateFilter('costCenterId', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Todos los centros" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los centros</SelectItem>
                        {costCenters.map((center) => (
                          <SelectItem key={center.id} value={center.id}>
                            {center.code} - {center.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Monto mínimo</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                        <Input
                          type="number"
                          value={filters.minAmount}
                          onChange={(e) => updateFilter('minAmount', e.target.value)}
                          placeholder="0"
                          className="pl-7"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Monto máximo</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
