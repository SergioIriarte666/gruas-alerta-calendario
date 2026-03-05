import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, X, Search, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export interface FilterConfig {
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
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
    // Debounce could be added here if needed, but for now direct update
    onFilterChange(newFilters);
  };

  const activeFilterCount = [
    filters.dateFrom,
    filters.dateTo,
    filters.clientName,
    filters.folio,
    filters.minAmount,
    filters.maxAmount,
    filters.status !== 'all' && filters.status
  ].filter(Boolean).length;

  return (
    <div className="space-y-4 mb-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente o folio..."
            value={localFilters.clientName || localFilters.folio || ''}
            onChange={(e) => {
              // Smart search: determines if it's folio (number) or client (text)
              // Actually, let's just use clientName for general text search for simplicity in this main input
              // or split logic. For now, let's map it to clientName as primary search
              handleChange('clientName', e.target.value);
            }}
            className="pl-9 w-full"
          />
        </div>

        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full sm:w-auto border-dashed">
              <Filter className="mr-2 h-4 w-4" />
              Filtros Avanzados
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-2 rounded-sm px-1 font-normal lg:hidden">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 sm:w-96 p-4" align="end">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium leading-none">Filtros</h4>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 px-2 lg:px-3"
                  onClick={() => {
                    onClearFilters();
                    setIsOpen(false);
                  }}
                >
                  Limpiar
                  <X className="ml-2 h-4 w-4" />
                </Button>
              </div>
              
              <Separator />

              <div className="space-y-2">
                <Label>Rango de Fechas</Label>
                <div className="grid grid-cols-2 gap-2">
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
                        {localFilters.dateFrom ? format(localFilters.dateFrom, "P", { locale: es }) : "Desde"}
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
                        {localFilters.dateTo ? format(localFilters.dateTo, "P", { locale: es }) : "Hasta"}
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

              <div className="space-y-2">
                <Label>Estado</Label>
                <Select
                  value={localFilters.status}
                  onValueChange={(value) => handleChange('status', value)}
                >
                  <SelectTrigger className="h-8 w-full">
                    <SelectValue placeholder="Seleccionar estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="paid">Pagada</SelectItem>
                    <SelectItem value="sent">Enviada</SelectItem>
                    <SelectItem value="overdue">Vencida</SelectItem>
                    <SelectItem value="cancelled">Anulada</SelectItem>
                    <SelectItem value="draft">Borrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Monto</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Mínimo"
                    type="number"
                    className="h-8"
                    value={localFilters.minAmount}
                    onChange={(e) => handleChange('minAmount', e.target.value)}
                  />
                  <Input
                    placeholder="Máximo"
                    type="number"
                    className="h-8"
                    value={localFilters.maxAmount}
                    onChange={(e) => handleChange('maxAmount', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Folio Exacto</Label>
                <Input
                  placeholder="Ej: 12345"
                  className="h-8"
                  value={localFilters.folio}
                  onChange={(e) => handleChange('folio', e.target.value)}
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2 pt-2">
          {localFilters.dateFrom && (
            <Badge variant="secondary" className="rounded-sm px-1 font-normal">
              Desde: {format(localFilters.dateFrom, "P", { locale: es })}
              <Button
                variant="ghost"
                size="sm"
                className="h-auto w-auto p-0 ml-1 hover:bg-transparent"
                onClick={() => handleChange('dateFrom', undefined)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
          {localFilters.dateTo && (
            <Badge variant="secondary" className="rounded-sm px-1 font-normal">
              Hasta: {format(localFilters.dateTo, "P", { locale: es })}
              <Button
                variant="ghost"
                size="sm"
                className="h-auto w-auto p-0 ml-1 hover:bg-transparent"
                onClick={() => handleChange('dateTo', undefined)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
          {localFilters.status && localFilters.status !== 'all' && (
            <Badge variant="secondary" className="rounded-sm px-1 font-normal">
              Estado: {localFilters.status}
              <Button
                variant="ghost"
                size="sm"
                className="h-auto w-auto p-0 ml-1 hover:bg-transparent"
                onClick={() => handleChange('status', 'all')}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
           {(localFilters.minAmount || localFilters.maxAmount) && (
            <Badge variant="secondary" className="rounded-sm px-1 font-normal">
              Monto: {localFilters.minAmount || '0'} - {localFilters.maxAmount || '∞'}
              <Button
                variant="ghost"
                size="sm"
                className="h-auto w-auto p-0 ml-1 hover:bg-transparent"
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
