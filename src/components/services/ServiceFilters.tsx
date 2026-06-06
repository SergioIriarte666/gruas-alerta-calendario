import { useState, useCallback } from 'react';
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
}: ServiceFiltersProps) => {
  const { operators } = useOperators();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [operatorId, setOperatorId] = useState('all');

  const applyAdvanced = useCallback((from: string, to: string, opId: string) => {
    const advanced: AdvancedFilters = {};
    if (from) advanced.dateFrom = new Date(from);
    if (to) advanced.dateTo = new Date(to);
    if (opId && opId !== 'all') advanced.operatorId = opId;
    onAdvancedFiltersChange(Object.keys(advanced).length > 0 ? advanced : null);
  }, [onAdvancedFiltersChange]);

  const handleClear = () => {
    onSearchChange('');
    onStatusChange('all');
    setDateFrom('');
    setDateTo('');
    setOperatorId('all');
    onAdvancedFiltersChange(null);
  };

  const hasFilters = searchTerm || (statusFilter && statusFilter !== 'all') || dateFrom || dateTo || (operatorId && operatorId !== 'all');

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

      <Select value={operatorId} onValueChange={(val) => {
        setOperatorId(val);
        applyAdvanced(dateFrom, dateTo, val);
      }}>
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
        value={dateFrom}
        onChange={(e) => {
          setDateFrom(e.target.value);
          applyAdvanced(e.target.value, dateTo, operatorId);
        }}
        className="w-36"
        title="Fecha desde"
      />
      <span className="text-muted-foreground text-sm">–</span>
      <Input
        type="date"
        value={dateTo}
        onChange={(e) => {
          setDateTo(e.target.value);
          applyAdvanced(dateFrom, e.target.value, operatorId);
        }}
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
