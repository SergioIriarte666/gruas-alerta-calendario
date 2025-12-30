import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, CalendarDays, CalendarRange, List, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type DateFilterType = 'all' | 'today' | 'week' | 'month';

interface InvoicesQuickFiltersProps {
  activeDateFilter: DateFilterType;
  onDateFilterChange: (filter: DateFilterType) => void;
  overdueCount?: number;
}

export const InvoicesQuickFilters = ({
  activeDateFilter,
  onDateFilterChange,
  overdueCount = 0
}: InvoicesQuickFiltersProps) => {
  const filters: { key: DateFilterType; label: string; icon: React.ElementType }[] = [
    { key: 'all', label: 'Todas', icon: List },
    { key: 'today', label: 'Hoy', icon: Calendar },
    { key: 'week', label: 'Esta Semana', icon: CalendarDays },
    { key: 'month', label: 'Este Mes', icon: CalendarRange },
  ];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm text-muted-foreground mr-1">Período:</span>
      {filters.map(({ key, label, icon: Icon }) => (
        <Button
          key={key}
          variant={activeDateFilter === key ? 'default' : 'outline'}
          size="sm"
          onClick={() => onDateFilterChange(key)}
          className={cn(
            'gap-1.5 h-8',
            activeDateFilter === key 
              ? 'bg-violet-600 hover:bg-violet-700 text-white' 
              : 'hover:bg-violet-50 hover:text-violet-700 hover:border-violet-300'
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </Button>
      ))}
      
      {overdueCount > 0 && (
        <Badge 
          variant="destructive" 
          className="ml-2 gap-1 animate-pulse"
        >
          <AlertCircle className="h-3 w-3" />
          {overdueCount} vencida{overdueCount !== 1 ? 's' : ''}
        </Badge>
      )}
    </div>
  );
};

export default InvoicesQuickFilters;
