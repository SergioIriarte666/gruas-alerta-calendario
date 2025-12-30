import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export type PaymentDateFilter = 'all' | 'today' | 'week' | 'month';

interface PaymentQuickFiltersProps {
  selected: PaymentDateFilter;
  onChange: (filter: PaymentDateFilter) => void;
  pendingCount?: number;
}

export const PaymentQuickFilters = ({ 
  selected, 
  onChange, 
  pendingCount = 0 
}: PaymentQuickFiltersProps) => {
  const filters: { key: PaymentDateFilter; label: string }[] = [
    { key: 'all', label: 'Todos' },
    { key: 'today', label: 'Hoy' },
    { key: 'week', label: 'Esta Semana' },
    { key: 'month', label: 'Este Mes' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-muted-foreground mr-1">Período:</span>
      {filters.map((filter) => (
        <Button
          key={filter.key}
          variant={selected === filter.key ? 'default' : 'outline'}
          size="sm"
          onClick={() => onChange(filter.key)}
          className={
            selected === filter.key
              ? 'bg-violet-600 hover:bg-violet-700 text-white'
              : 'hover:bg-violet-50 hover:border-violet-300'
          }
        >
          {filter.label}
        </Button>
      ))}
      
      {pendingCount > 0 && (
        <div className="flex items-center gap-1.5 ml-2 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full text-sm font-medium">
          <AlertCircle className="h-3.5 w-3.5" />
          {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
};
