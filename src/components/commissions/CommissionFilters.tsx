import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Filter, X } from 'lucide-react';
import { CommissionFilters } from '@/types/commissions';
import DatePickerInput from '@/components/common/DatePickerInput';
import { format, parse } from 'date-fns';

interface CommissionFiltersProps {
  filters: CommissionFilters;
  onFiltersChange: (filters: CommissionFilters) => void;
  operators: Array<{ id: string; name: string; }>;
}

export const CommissionFiltersComponent: React.FC<CommissionFiltersProps> = ({
  filters,
  onFiltersChange,
  operators
}) => {
  const handleFilterChange = (key: keyof CommissionFilters, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange({
      status: 'all',
      operator_id: undefined,
      client_name: undefined,
      date_from: undefined,
      date_to: undefined,
      amount_from: undefined,
      amount_to: undefined,
    });
  };

  const hasActiveFilters = Object.entries(filters).some(([key, value]) => 
    key !== 'status' && value !== undefined && value !== ''
  ) || filters.status !== 'all';

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4" />
          <span className="font-medium">Filtros</span>
        </div>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4 mr-1" />
            Limpiar
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
        <div>
          <label className="text-sm font-medium mb-1 block">Estado</label>
          <Select
            value={filters.status}
            onValueChange={(value: 'all' | 'pending' | 'paid') => handleFilterChange('status', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="pending">Pendientes</SelectItem>
              <SelectItem value="paid">Pagadas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">Operador</label>
          <Select
            value={filters.operator_id || "all"}
            onValueChange={(value) => handleFilterChange('operator_id', value === "all" ? undefined : value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos los operadores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los operadores</SelectItem>
              {operators.map((operator) => (
                <SelectItem key={operator.id} value={operator.id}>
                  {operator.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">Cliente</label>
          <Input
            placeholder="Buscar por cliente..."
            value={filters.client_name || ""}
            onChange={(e) => handleFilterChange('client_name', e.target.value || undefined)}
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">Fecha desde</label>
          <DatePickerInput
            value={filters.date_from ? format(filters.date_from, 'yyyy-MM-dd') : ""}
            onChange={(value) => handleFilterChange('date_from', value ? parse(value, 'yyyy-MM-dd', new Date()) : undefined)}
            placeholder="Seleccionar"
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">Fecha hasta</label>
          <DatePickerInput
            value={filters.date_to ? format(filters.date_to, 'yyyy-MM-dd') : ""}
            onChange={(value) => handleFilterChange('date_to', value ? parse(value, 'yyyy-MM-dd', new Date()) : undefined)}
            placeholder="Seleccionar"
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">Monto desde</label>
          <Input
            type="number"
            placeholder="0"
            value={filters.amount_from || ""}
            onChange={(e) => handleFilterChange('amount_from', e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">Monto hasta</label>
          <Input
            type="number"
            placeholder="999999999"
            value={filters.amount_to || ""}
            onChange={(e) => handleFilterChange('amount_to', e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
      </div>
    </Card>
  );
};