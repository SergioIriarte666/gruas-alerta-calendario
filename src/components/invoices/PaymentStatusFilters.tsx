import { Button } from '@/components/ui/button';

export type PaymentStatusFilter = 'all' | 'pending' | 'partial' | 'applied';

interface PaymentStatusFiltersProps {
  selected: PaymentStatusFilter;
  onChange: (filter: PaymentStatusFilter) => void;
  counts: {
    pending: number;
    partial: number;
    applied: number;
  };
}

export const PaymentStatusFilters = ({ 
  selected, 
  onChange,
  counts
}: PaymentStatusFiltersProps) => {
  const filters: { key: PaymentStatusFilter; label: string; count?: number }[] = [
    { key: 'all', label: 'Todos' },
    { key: 'pending', label: 'Pendientes', count: counts.pending },
    { key: 'partial', label: 'Parciales', count: counts.partial },
    { key: 'applied', label: 'Aplicados', count: counts.applied },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-muted-foreground mr-1">Estado:</span>
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
          {filter.count !== undefined && filter.count > 0 && (
            <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${
              selected === filter.key 
                ? 'bg-white/20 text-white' 
                : 'bg-violet-100 text-violet-700'
            }`}>
              {filter.count}
            </span>
          )}
        </Button>
      ))}
    </div>
  );
};
