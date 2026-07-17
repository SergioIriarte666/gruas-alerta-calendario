import React, { useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import DatePickerInput from '@/components/common/DatePickerInput';
import { useOperators } from '@/hooks/useOperators';
import { AdvancedFilters } from '@/hooks/useAdvancedFilters';
import { cn } from '@/lib/utils';

interface ServiceFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  onAdvancedFiltersChange: (filters: AdvancedFilters | null) => void;
  listDateFrom?: string;
  listDateTo?: string;
  onListDateFromChange?: (val: string) => void;
  onListDateToChange?: (val: string) => void;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'in_progress', label: 'En Progreso' },
  { value: 'completed', label: 'Completado' },
  { value: 'cancelled', label: 'Cancelado' },
  { value: 'invoiced', label: 'Facturado' },
  { value: 'quoted', label: 'Cotizado' },
  { value: 'purchase_order_pending', label: 'Esperando O.C.' },
  { value: 'with_purchase_order', label: 'Con O.C.' },
  { value: 'failed', label: 'Fallido' },
];

export const ServiceFilters = React.memo(({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusChange,
  onAdvancedFiltersChange,
  listDateFrom = '',
  listDateTo = '',
  onListDateFromChange,
  onListDateToChange,
}: ServiceFiltersProps) => {
  const { operators } = useOperators();
  const controlClassName =
    'h-10 rounded-lg border-border/70 bg-background/70 text-foreground shadow-sm transition-colors hover:bg-accent/40';

  const applyAdvanced = useCallback((opId: string) => {
    const advanced: AdvancedFilters = {};
    if (opId && opId !== 'all') advanced.operatorId = opId;
    onAdvancedFiltersChange(Object.keys(advanced).length > 0 ? advanced : null);
  }, [onAdvancedFiltersChange]);

  const handleClear = () => {
    onSearchChange('');
    onStatusChange('all');
    onAdvancedFiltersChange(null);
    onListDateFromChange?.('');
    onListDateToChange?.('');
  };

  const hasFilters = Boolean(
    searchTerm ||
    (statusFilter && statusFilter !== 'all') ||
    listDateFrom ||
    listDateTo
  );

  return (
    <div className="services-filter-bar flex flex-wrap items-center gap-2 p-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input
          placeholder="Folio, cliente, patente..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className={cn('w-56 pl-8', controlClassName)}
        />
      </div>

      <Select value={statusFilter || 'all'} onValueChange={onStatusChange}>
        <SelectTrigger className={cn('w-44', controlClassName)}>
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select defaultValue="all" onValueChange={(val) => applyAdvanced(val)}>
        <SelectTrigger className={cn('w-44', controlClassName)}>
          <SelectValue placeholder="Operador" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los operadores</SelectItem>
          {operators.map(op => (
            <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <DatePickerInput
        value={listDateFrom}
        onChange={(value) => onListDateFromChange?.(value)}
        placeholder="Desde"
        className={cn(
          'h-10 w-[176px] rounded-lg border-border/70 px-3 text-foreground shadow-sm hover:bg-accent/40',
          listDateFrom
            ? 'border-[hsl(var(--dashboard-lime)/0.45)] bg-[hsl(var(--dashboard-lime)/0.10)]'
            : 'bg-background/70'
        )}
        id="services-date-from"
      />
      <span className="text-muted-foreground text-sm">–</span>
      <DatePickerInput
        value={listDateTo}
        onChange={(value) => onListDateToChange?.(value)}
        placeholder="Hasta"
        className={cn(
          'h-10 w-[176px] rounded-lg border-border/70 px-3 text-foreground shadow-sm hover:bg-accent/40',
          listDateTo
            ? 'border-[hsl(var(--dashboard-lime)/0.45)] bg-[hsl(var(--dashboard-lime)/0.10)]'
            : 'bg-background/70'
        )}
        id="services-date-to"
      />

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="h-10 rounded-lg px-3 text-muted-foreground hover:bg-accent/50 hover:text-foreground"
        >
          <X className="size-3" />
          Limpiar
        </Button>
      )}
    </div>
  );
});
