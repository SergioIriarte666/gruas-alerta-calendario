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
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PurchaseFilterConfig {
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  supplierName: string;
  invoiceNumber: string;
  minAmount: string;
  maxAmount: string;
  status: string;
  productName: string;
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
  const handleChange = (key: keyof PurchaseFilterConfig, value: any) => {
    onFilterChange({ ...filters, [key]: value });
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Search by Supplier */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Proveedor</label>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar proveedor..."
            value={filters.supplierName}
            onChange={(e) => handleChange('supplierName', e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Search by Product */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Producto / Descripción</label>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar producto (incluye inventario)..."
            value={filters.productName || ''}
            onChange={(e) => handleChange('productName', e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Search by Invoice Number */}
      <div className="space-y-2">
        <label className="text-sm font-medium">N° Factura</label>
        <Input
          placeholder="Buscar folio..."
          value={filters.invoiceNumber}
          onChange={(e) => handleChange('invoiceNumber', e.target.value)}
        />
      </div>

      {/* Status Filter */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Estado</label>
        <Select
          value={filters.status}
          onValueChange={(value) => handleChange('status', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="paid">Pagada</SelectItem>
            <SelectItem value="pending">Pendiente</SelectItem>
            <SelectItem value="overdue">Vencida</SelectItem>
            <SelectItem value="cancelled">Anulada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Date Range - From */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Desde</label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'w-full justify-start text-left font-normal',
                !filters.dateFrom && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filters.dateFrom ? (
                format(filters.dateFrom, 'PPP', { locale: es })
              ) : (
                <span>Seleccionar fecha</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={filters.dateFrom}
              onSelect={(date) => handleChange('dateFrom', date)}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Date Range - To */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Hasta</label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'w-full justify-start text-left font-normal',
                !filters.dateTo && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filters.dateTo ? (
                format(filters.dateTo, 'PPP', { locale: es })
              ) : (
                <span>Seleccionar fecha</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={filters.dateTo}
              onSelect={(date) => handleChange('dateTo', date)}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Amount Range - Min */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Monto Mínimo</label>
        <Input
          type="number"
          placeholder="0"
          value={filters.minAmount}
          onChange={(e) => handleChange('minAmount', e.target.value)}
        />
      </div>

      {/* Amount Range - Max */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Monto Máximo</label>
        <Input
          type="number"
          placeholder="Sin límite"
          value={filters.maxAmount}
          onChange={(e) => handleChange('maxAmount', e.target.value)}
        />
      </div>

      {/* Clear Filters Button */}
      <div className="flex items-end">
        <Button
          variant="secondary"
          className="w-full"
          onClick={onClearFilters}
        >
          <X className="mr-2 h-4 w-4" />
          Limpiar Filtros
        </Button>
      </div>
    </div>
  );
};
