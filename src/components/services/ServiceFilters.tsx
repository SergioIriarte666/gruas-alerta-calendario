import React, { useCallback } from 'react';
import { MapPinOff, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import DatePickerInput from '@/components/common/DatePickerInput';
import { useOperators } from '@/hooks/useOperators';
import { AdvancedFilters } from '@/hooks/useAdvancedFilters';
import { cn } from '@/lib/utils';
import { OperatorSelectLabel } from '@/components/operators/OperatorAppAccessBadge';

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
  withoutCoordinates?: boolean;
  onWithoutCoordinatesChange?: (value: boolean) => void;
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
  { value: 'written_off', label: 'Castigado' },
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
  withoutCoordinates = false,
  onWithoutCoordinatesChange,
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
    onWithoutCoordinatesChange?.(false);
  };

  const hasFilters = Boolean(
    searchTerm ||
    (statusFilter && statusFilter !== 'all') ||
    listDateFrom ||
    listDateTo ||
    withoutCoordinates
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
            <SelectItem key={op.id} value={op.id}>
              <OperatorSelectLabel operator={op} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <DatePickerInput
        value={listDateFrom}
        onChange={(value) => onListDateFromChange?.(value)}
        placeholder="Desde"
        className={cn(
          'h-10 w-44 rounded-lg border-border/70 px-3 text-foreground shadow-sm hover:bg-accent/40',
          listDateFrom
            ? 'border-success/50 bg-success/10'
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
          'h-10 w-44 rounded-lg border-border/70 px-3 text-foreground shadow-sm hover:bg-accent/40',
          listDateTo
            ? 'border-success/50 bg-success/10'
            : 'bg-background/70'
        )}
        id="services-date-to"
      />

      {/* Recuperacion de historicos: aisla los servicios con direccion escrita
          pero sin punto, que son los que no generan seguimiento ni metricas. */}
      <Button
        type="button"
        variant={withoutCoordinates ? 'secondary' : 'ghost'}
        size="sm"
        aria-pressed={withoutCoordinates}
        onClick={() => onWithoutCoordinatesChange?.(!withoutCoordinates)}
        className={cn(
          'h-10 rounded-lg px-3',
          withoutCoordinates
            ? 'border border-warning/40 bg-warning/10 text-warning-text hover:bg-warning/20'
            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
        )}
      >
        <MapPinOff className="mr-1.5 size-3.5" />
        Sin coordenada
      </Button>

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
