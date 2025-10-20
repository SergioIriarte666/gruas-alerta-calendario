import { Search, Filter, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IncomeFilters as IIncomeFilters } from '@/types/incomes';
import { useIncomeCategories } from '@/hooks/incomes/useIncomeCategories';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface IncomeFiltersProps {
  filters: IIncomeFilters;
  onFiltersChange: (filters: IIncomeFilters) => void;
  onSearch: (term: string) => void;
  searchTerm: string;
}

export const IncomeFilters = ({ filters, onFiltersChange, onSearch, searchTerm }: IncomeFiltersProps) => {
  const { data: categories = [] } = useIncomeCategories();
  
  const { data: clients = [] } = useQuery({
    queryKey: ['clients-for-filters'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
  });

  const handleReset = () => {
    onFiltersChange({
      category: 'all',
      dateFrom: null,
      dateTo: null,
      clientId: 'all',
      paymentMethod: 'all',
      minAmount: '',
      maxAmount: '',
    });
    onSearch('');
  };

  const hasActiveFilters = 
    filters.category !== 'all' ||
    filters.dateFrom !== null ||
    filters.dateTo !== null ||
    filters.clientId !== 'all' ||
    filters.paymentMethod !== 'all' ||
    filters.minAmount !== '' ||
    filters.maxAmount !== '' ||
    searchTerm !== '';

  return (
    <div className="bg-card border rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-foreground">Filtros</h3>
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={handleReset}>
            <X className="h-4 w-4 mr-2" />
            Limpiar filtros
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por descripción..."
            value={searchTerm}
            onChange={(e) => onSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          value={filters.category}
          onValueChange={(value) => onFiltersChange({ ...filters, category: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Categoría" />
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

        <Select
          value={filters.clientId}
          onValueChange={(value) => onFiltersChange({ ...filters, clientId: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los clientes</SelectItem>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.paymentMethod}
          onValueChange={(value) => onFiltersChange({ ...filters, paymentMethod: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Método de pago" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los métodos</SelectItem>
            <SelectItem value="transferencia">Transferencia</SelectItem>
            <SelectItem value="efectivo">Efectivo</SelectItem>
            <SelectItem value="cheque">Cheque</SelectItem>
            <SelectItem value="deposito">Depósito</SelectItem>
            <SelectItem value="tarjeta_credito">Tarjeta de Crédito</SelectItem>
            <SelectItem value="tarjeta_debito">Tarjeta de Débito</SelectItem>
            <SelectItem value="otro">Otro</SelectItem>
          </SelectContent>
        </Select>

        <Input
          type="date"
          value={filters.dateFrom || ''}
          onChange={(e) => onFiltersChange({ ...filters, dateFrom: e.target.value || null })}
          placeholder="Fecha desde"
        />

        <Input
          type="date"
          value={filters.dateTo || ''}
          onChange={(e) => onFiltersChange({ ...filters, dateTo: e.target.value || null })}
          placeholder="Fecha hasta"
        />

        <Input
          type="number"
          value={filters.minAmount}
          onChange={(e) => onFiltersChange({ ...filters, minAmount: e.target.value })}
          placeholder="Monto mínimo"
        />

        <Input
          type="number"
          value={filters.maxAmount}
          onChange={(e) => onFiltersChange({ ...filters, maxAmount: e.target.value })}
          placeholder="Monto máximo"
        />
      </div>
    </div>
  );
};
