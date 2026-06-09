import { useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useOperators } from '@/hooks/useOperators';
import { AdvancedFilters } from '@/hooks/useAdvancedFilters';

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

export const ServiceFilters = ({
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

  const applyAdvanced = useCallback((opId: string) => {
    const advanced: AdvancedFilters = {};
    if (opId && opId !== 'all') advanced.operatorId = opId;
    onAdvancedFiltersChange(Object.keys(advanced).length > 0 ? advanced : null);
  }, [onAdvancedFiltersChange]);

  const handleClear = () => {
    onSearchChange('');
    onStatusChange('all');
    onAdvancedFiltersChange(null);
  };

  const hasFilters = searchTerm || (statusFilter && statusFilter !== 'all');

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input
          placeholder="Folio, cliente, patente..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-8 w-56"
        />
      </div>

      <Select value={statusFilter || 'all'} onValueChange={onStatusChange}>
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select defaultValue="all" onValueChange={(val) => applyAdvanced(val)}>
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Operador" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los operadores</SelectItem>
          {operators.map(op => (
            <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        type="date"
        value={listDateFrom}
        onChange={(e) => onListDateFromChange?.(e.target.value)}
        className="w-36"
        title="Fecha desde"
      />
      <span className="text-muted-foreground text-sm">–</span>
      <Input
        type="date"
        value={listDateTo}
        onChange={(e) => onListDateToChange?.(e.target.value)}
        className="w-36"
        title="Fecha hasta"
      />

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={handleClear} className="gap-1">
          <X className="size-3" />
          Limpiar
        </Button>
      )}
    </div>
  );
};
