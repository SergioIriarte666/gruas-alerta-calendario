import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format, subMonths, startOfMonth, startOfYear, endOfMonth, endOfYear } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, Search, X, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { businessClock } from '@/utils/businessClock';
import { SourceFilter, SOURCE_FILTER_OPTIONS } from './useSourceFilter';

export interface PurchaseFilterConfig {
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  searchTerm: string;
  supplierName: string;
  invoiceNumber: string;
  minAmount: string;
  maxAmount: string;
  status: string;
  productName: string;
  source: SourceFilter;
}

interface HistoricalPurchasesFiltersProps {
  filters: PurchaseFilterConfig;
  onFilterChange: (filters: PurchaseFilterConfig) => void;
  onClearFilters: () => void;
}

export const HistoricalPurchasesFilters = ({
  filters,
  onFilterChange,
  onClearFilters,
}: HistoricalPurchasesFiltersProps) => {
  const [localFilters, setLocalFilters] = useState<PurchaseFilterConfig>(filters);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleChange = (key: keyof PurchaseFilterConfig, value: any) => {
    let next = { ...localFilters, [key]: value };
    // Valida que "Desde" no sea posterior a "Hasta": si se viola, ajusta el otro extremo.
    if (key === 'dateFrom' && value && next.dateTo && value > next.dateTo) {
      next = { ...next, dateTo: value };
    }
    if (key === 'dateTo' && value && next.dateFrom && value < next.dateFrom) {
      next = { ...next, dateFrom: value };
    }
    setLocalFilters(next);
    onFilterChange(next);
  };

  const applyQuickDate = (type: 'thisMonth' | 'lastMonth' | 'thisYear' | 'lastYear') => {
    const today = businessClock.todayDate();
    let from: Date;
    let to: Date;

    switch (type) {
      case 'thisMonth':
        from = startOfMonth(today);
        to = endOfMonth(today);
        break;
      case 'lastMonth': {
        const lastMonth = subMonths(today, 1);
        from = startOfMonth(lastMonth);
        to = endOfMonth(lastMonth);
        break;
      }
      case 'thisYear':
        // No incluir meses/días futuros: el tope es hoy, no el 31 de diciembre.
        from = startOfYear(today);
        to = today;
        break;
      default: {
        const lastYear = subMonths(today, 12);
        from = startOfYear(lastYear);
        to = endOfYear(lastYear);
        break;
      }
    }

    const next = { ...localFilters, dateFrom: from, dateTo: to };
    setLocalFilters(next);
    onFilterChange(next);
  };

  const activeFilterCount = [
    filters.dateFrom,
    filters.dateTo,
    filters.supplierName,
    filters.productName,
    filters.invoiceNumber,
    filters.minAmount,
    filters.maxAmount,
    filters.status !== 'all' && filters.status,
    filters.source !== 'all' && filters.source,
    filters.searchTerm,
  ].filter(Boolean).length;

  return (
    <div className="space-y-4 mb-6 bg-card p-4 rounded-lg border shadow-sm">
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div className="relative flex-1 w-full lg:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por proveedor, N° factura o descripción..."
            value={localFilters.searchTerm || ''}
            onChange={(e) => handleChange('searchTerm', e.target.value)}
            className="pl-9 w-full bg-background"
          />
        </div>

        <div className="flex flex-wrap gap-2 w-full lg:w-auto">
          <div className="hidden sm:flex gap-1 border rounded-md p-1 bg-muted/20">
            <Button variant="ghost" size="sm" onClick={() => applyQuickDate('thisMonth')} className="h-7 text-xs">Este Mes</Button>
            <Button variant="ghost" size="sm" onClick={() => applyQuickDate('lastMonth')} className="h-7 text-xs">Mes Anterior</Button>
            <Button variant="ghost" size="sm" onClick={() => applyQuickDate('thisYear')} className="h-7 text-xs">Este Año</Button>
            <Button variant="ghost" size="sm" onClick={() => applyQuickDate('lastYear')} className="h-7 text-xs">Año Anterior</Button>
          </div>

          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn('ml-auto lg:ml-0 gap-2', activeFilterCount > 0 && 'border-primary text-primary')}
              >
                <SlidersHorizontal className="size-4" />
                Filtros
                {activeFilterCount > 0 && (
                  <Badge variant="default" className="ml-1 rounded-full size-5 p-0 flex items-center justify-center text-[10px]">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-80 sm:w-96 p-0 max-h-[var(--radix-popover-content-available-height)] overflow-hidden"
              align="end"
              side="top"
              sideOffset={8}
              collisionPadding={12}
            >
              <div className="max-h-[var(--radix-popover-content-available-height)] overflow-auto p-4">
                <div className="sticky top-0 z-10 bg-popover pb-3">
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
                      <X className="ml-2 size-3" />
                    </Button>
                  </div>
                  <Separator className="mt-3" />
                </div>

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
                            className={cn('w-full justify-start text-left font-normal', !localFilters.dateFrom && 'text-muted-foreground')}
                          >
                            <CalendarIcon className="mr-2 size-3" />
                            {localFilters.dateFrom ? format(localFilters.dateFrom, 'P', { locale: es }) : 'Seleccionar'}
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
                            className={cn('w-full justify-start text-left font-normal', !localFilters.dateTo && 'text-muted-foreground')}
                          >
                            <CalendarIcon className="mr-2 size-3" />
                            {localFilters.dateTo ? format(localFilters.dateTo, 'P', { locale: es }) : 'Seleccionar'}
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
                  <p className="text-[11px] text-muted-foreground">
                    Si "Desde" queda después de "Hasta", se ajusta automáticamente para mantener el rango válido.
                  </p>
                </div>

                <div className="space-y-3 mt-3">
                  <Label className="text-xs font-medium text-muted-foreground uppercase">Origen</Label>
                  <Select
                    value={localFilters.source}
                    onValueChange={(value) => handleChange('source', value as SourceFilter)}
                  >
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue placeholder="Seleccionar origen" />
                    </SelectTrigger>
                    <SelectContent>
                      {SOURCE_FILTER_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3 mt-3">
                  <Label className="text-xs font-medium text-muted-foreground uppercase">Proveedor</Label>
                  <Input
                    placeholder="Ej: Copec"
                    className="h-9"
                    value={localFilters.supplierName}
                    onChange={(e) => handleChange('supplierName', e.target.value)}
                  />
                </div>

                <div className="space-y-3 mt-3">
                  <Label className="text-xs font-medium text-muted-foreground uppercase">Producto / Descripción</Label>
                  <Input
                    placeholder="Ej: aceite, filtro..."
                    className="h-9"
                    value={localFilters.productName || ''}
                    onChange={(e) => handleChange('productName', e.target.value)}
                  />
                </div>

                <div className="space-y-3 mt-3">
                  <Label className="text-xs font-medium text-muted-foreground uppercase">N° Factura</Label>
                  <Input
                    placeholder="Ej: 12345"
                    className="h-9"
                    value={localFilters.invoiceNumber}
                    onChange={(e) => handleChange('invoiceNumber', e.target.value)}
                  />
                </div>

                <div className="space-y-3 mt-3">
                  <Label className="text-xs font-medium text-muted-foreground uppercase">Estado</Label>
                  <Select value={localFilters.status} onValueChange={(value) => handleChange('status', value)}>
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue placeholder="Seleccionar estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los estados</SelectItem>
                      <SelectItem value="paid">Pagada</SelectItem>
                      <SelectItem value="pending">Pendiente</SelectItem>
                      <SelectItem value="overdue">Vencida</SelectItem>
                      <SelectItem value="partial">Parcial</SelectItem>
                      <SelectItem value="cancelled">Anulada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3 mt-3">
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
              </div>

              <div className="sticky bottom-0 z-10 bg-popover border-t px-4 py-3 flex items-center justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsOpen(false)}>
                  Cerrar
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    onClearFilters();
                    setIsOpen(false);
                  }}
                >
                  Limpiar
                </Button>
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
                className="size-auto p-0 ml-2 hover:bg-transparent text-blue-700"
                onClick={() => handleChange('dateFrom', undefined)}
              >
                <X className="size-3" />
              </Button>
            </Badge>
          )}
          {localFilters.dateTo && (
            <Badge variant="secondary" className="rounded-md px-2 py-1 font-normal bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200">
              Hasta: {format(localFilters.dateTo, "P", { locale: es })}
              <Button
                variant="ghost"
                size="sm"
                className="size-auto p-0 ml-2 hover:bg-transparent text-blue-700"
                onClick={() => handleChange('dateTo', undefined)}
              >
                <X className="size-3" />
              </Button>
            </Badge>
          )}
          {localFilters.source && localFilters.source !== 'all' && (
            <Badge variant="secondary" className="rounded-md px-2 py-1 font-normal bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200">
              Origen: {SOURCE_FILTER_OPTIONS.find((o) => o.value === localFilters.source)?.label}
              <Button
                variant="ghost"
                size="sm"
                className="size-auto p-0 ml-2 hover:bg-transparent text-purple-700"
                onClick={() => handleChange('source', 'all')}
              >
                <X className="size-3" />
              </Button>
            </Badge>
          )}
          {localFilters.status && localFilters.status !== 'all' && (
            <Badge variant="secondary" className="rounded-md px-2 py-1 font-normal bg-orange-50 text-orange-700 hover:bg-orange-100 border-orange-200">
              Estado: {localFilters.status}
              <Button
                variant="ghost"
                size="sm"
                className="size-auto p-0 ml-2 hover:bg-transparent text-orange-700"
                onClick={() => handleChange('status', 'all')}
              >
                <X className="size-3" />
              </Button>
            </Badge>
          )}
          {(localFilters.minAmount || localFilters.maxAmount) && (
            <Badge variant="secondary" className="rounded-md px-2 py-1 font-normal bg-green-50 text-green-700 hover:bg-green-100 border-green-200">
              Monto: {localFilters.minAmount || '0'} - {localFilters.maxAmount || '∞'}
              <Button
                variant="ghost"
                size="sm"
                className="size-auto p-0 ml-2 hover:bg-transparent text-green-700"
                onClick={() => {
                  handleChange('minAmount', '');
                  handleChange('maxAmount', '');
                }}
              >
                <X className="size-3" />
              </Button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
};
