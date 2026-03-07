import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { format, subMonths, startOfMonth, startOfYear, endOfMonth, endOfYear } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, X, Search, Filter, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export interface FilterConfig {
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  searchTerm: string;
  clientName: string;
  folio: string;
  minAmount: string;
  maxAmount: string;
  status: string;
}

interface HistoricalSalesFiltersProps {
  filters: FilterConfig;
  onFilterChange: (filters: FilterConfig) => void;
  onClearFilters: () => void;
}

export const HistoricalSalesFilters = ({
  filters,
  onFilterChange,
  onClearFilters,
}: HistoricalSalesFiltersProps) => {
  const [localFilters, setLocalFilters] = useState<FilterConfig>(filters);
  const [isOpen, setIsOpen] = useState(false);

  // Update local state when props change
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleChange = (key: keyof FilterConfig, value: any) => {
    const newFilters = { ...localFilters, [key]: value };
    setLocalFilters(newFilters);
    onFilterChange(newFilters);
  };

  const applyQuickDate = (type: 'thisMonth' | 'lastMonth' | 'thisYear' | 'lastYear') => {
    const today = new Date();
    let from, to;

    switch (type) {
      case 'thisMonth':
        from = startOfMonth(today);
        to = endOfMonth(today);
        break;
      case 'lastMonth':
        const lastMonth = subMonths(today, 1);
        from = startOfMonth(lastMonth);
        to = endOfMonth(lastMonth);
        break;
      case 'thisYear':
        from = startOfYear(today);
        to = endOfYear(today);
        break;
      case 'lastYear':
        const lastYear = subMonths(today, 12);
        from = startOfYear(lastYear);
        to = endOfYear(lastYear);
        break;
    }
    
    const newFilters = { ...localFilters, dateFrom: from, dateTo: to };
    setLocalFilters(newFilters);
    onFilterChange(newFilters);
  };

  const activeFilterCount = [
    filters.dateFrom,
    filters.dateTo,
    filters.clientName,
    filters.folio,
    filters.minAmount,
    filters.maxAmount,
    filters.status !== 'all' && filters.status,
    filters.searchTerm,
  ].filter(Boolean).length;

  return (
    <div className="space-y-4 mb-6 bg-card p-4 rounded-lg border shadow-sm">
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        
        {/* Search Bar */}
        <div className="relative flex-1 w-full lg:max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por N° fiscal, cliente o folio..."
            value={localFilters.searchTerm || ''}
            onChange={(e) => handleChange('searchTerm', e.target.value)}
            className="pl-9 w-full bg-background"
          />
        </div>

        {/* Quick Actions & Filters */}
        <div className="flex flex-wrap gap-2 w-full lg:w-auto">
           <div className="hidden sm:flex gap-1 border rounded-md p-1 bg-muted/20">
            <Button variant="ghost" size="sm" onClick={() => applyQuickDate('thisMonth')} className="h-7 text-xs">Este Mes</Button>
            <Button variant="ghost" size="sm" onClick={() => applyQuickDate('lastMonth')} className="h-7 text-xs">Mes Anterior</Button>
            <Button variant="ghost" size="sm" onClick={() => applyQuickDate('thisYear')} className="h-7 text-xs">Este Año</Button>
          </div>

          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("ml-auto lg:ml-0 gap-2", activeFilterCount > 0 && "border-primary text-primary")}>
                <SlidersHorizontal className="h-4 w-4" />
                Filtros
                {activeFilterCount > 0 && (
                  <Badge variant="default" className="ml-1 rounded-full h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 sm:w-96 p-4" align="end">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium leading-none">Filtros Avanzados</h4>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 px-2 lg:px-3 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      onClearFilters();
                      setIsOpen(false);
                    }}
                  >
                    Limpiar todo
                    <X className="ml-2 h-3 w-3" />
                  </Button>
                </div>
                
                <Separator />

                <div className="space-y-3">
                  <Label className="text-xs font-medium text-muted-foreground uppercase">Rango de Fechas</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Desde</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !localFilters.dateFrom && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-3 w-3" />
                            {localFilters.dateFrom ? format(localFilters.dateFrom, "P", { locale: es }) : "Seleccionar"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={localFilters.dateFrom}
                            onSelect={(date) => handleChange('dateFrom', date)}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Hasta</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !localFilters.dateTo && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-3 w-3" />
                            {localFilters.dateTo ? format(localFilters.dateTo, "P", { locale: es }) : "Seleccionar"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={localFilters.dateTo}
                            onSelect={(date) => handleChange('dateTo', date)}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-xs font-medium text-muted-foreground uppercase">Estado</Label>
                  <Select
                    value={localFilters.status}
                    onValueChange={(value) => handleChange('status', value)}
                  >
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue placeholder="Seleccionar estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los estados</SelectItem>
                      <SelectItem value="paid">Pagada</SelectItem>
                      <SelectItem value="sent">Enviada</SelectItem>
                      <SelectItem value="overdue">Vencida</SelectItem>
                      <SelectItem value="cancelled">Anulada</SelectItem>
                      <SelectItem value="draft">Borrador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label className="text-xs font-medium text-muted-foreground uppercase">Monto ($)</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Mínimo"
                      type="number"
                      className="h-9"
                      value={localFilters.minAmount}
                      onChange={(e) => handleChange('minAmount', e.target.value)}
                    />
                    <Input
                      placeholder="Máximo"
                      type="number"
                      className="h-9"
                      value={localFilters.maxAmount}
                      onChange={(e) => handleChange('maxAmount', e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-xs font-medium text-muted-foreground uppercase">Folio Exacto</Label>
                  <Input
                    placeholder="Ej: 12345"
                    className="h-9"
                    value={localFilters.folio}
                    onChange={(e) => handleChange('folio', e.target.value)}
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2 pt-2 border-t mt-4">
          <span className="text-xs text-muted-foreground self-center mr-2">Filtros activos:</span>
          {localFilters.dateFrom && (
            <Badge variant="secondary" className="rounded-md px-2 py-1 font-normal bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200">
              Desde: {format(localFilters.dateFrom, "P", { locale: es })}
              <Button
                variant="ghost"
                size="sm"
                className="h-auto w-auto p-0 ml-2 hover:bg-transparent text-blue-700"
                onClick={() => handleChange('dateFrom', undefined)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
          {localFilters.dateTo && (
            <Badge variant="secondary" className="rounded-md px-2 py-1 font-normal bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200">
              Hasta: {format(localFilters.dateTo, "P", { locale: es })}
              <Button
                variant="ghost"
                size="sm"
                className="h-auto w-auto p-0 ml-2 hover:bg-transparent text-blue-700"
                onClick={() => handleChange('dateTo', undefined)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
          {localFilters.status && localFilters.status !== 'all' && (
            <Badge variant="secondary" className="rounded-md px-2 py-1 font-normal bg-orange-50 text-orange-700 hover:bg-orange-100 border-orange-200">
              Estado: {localFilters.status}
              <Button
                variant="ghost"
                size="sm"
                className="h-auto w-auto p-0 ml-2 hover:bg-transparent text-orange-700"
                onClick={() => handleChange('status', 'all')}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
           {(localFilters.minAmount || localFilters.maxAmount) && (
            <Badge variant="secondary" className="rounded-md px-2 py-1 font-normal bg-green-50 text-green-700 hover:bg-green-100 border-green-200">
              Monto: {localFilters.minAmount || '0'} - {localFilters.maxAmount || '∞'}
              <Button
                variant="ghost"
                size="sm"
                className="h-auto w-auto p-0 ml-2 hover:bg-transparent text-green-700"
                onClick={() => {
                  handleChange('minAmount', '');
                  handleChange('maxAmount', '');
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
};
