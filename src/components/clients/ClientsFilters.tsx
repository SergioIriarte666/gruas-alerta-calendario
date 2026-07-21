import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StatusFilter = 'all' | 'active' | 'inactive';

interface ClientsFiltersProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (value: StatusFilter) => void;
  departments: string[];
  selectedDepartment: string;
  setSelectedDepartment: (value: string) => void;
  activeCount: number;
  inactiveCount: number;
  totalCount: number;
}

export const ClientsFilters = ({
  searchTerm, setSearchTerm,
  statusFilter, setStatusFilter,
  departments, selectedDepartment, setSelectedDepartment,
  activeCount, inactiveCount, totalCount,
}: ClientsFiltersProps) => {
  const statusOptions: { value: StatusFilter; label: string; count: number }[] = [
    { value: 'all', label: 'Todos', count: totalCount },
    { value: 'active', label: 'Activos', count: activeCount },
    { value: 'inactive', label: 'Inactivos', count: inactiveCount },
  ];

  return (
    <Card className="operations-filter-panel border-border/70 bg-card/80 shadow-sm">
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground size-4" />
            <Input
              type="text"
              placeholder="Buscar por nombre, RUT o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-11 rounded-xl border-border/70 bg-background/70 pl-10"
            />
          </div>

          {/* Status chips */}
          <div className="flex items-center gap-2 flex-wrap">
            {statusOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-colors',
                  statusFilter === opt.value
                    ? 'operations-filter-active'
                    : 'bg-background/70 text-muted-foreground border-border/70 hover:bg-muted'
                )}
              >
                {opt.label}
                <span className={cn(
                  'rounded-full px-1.5 py-0.5 text-xs font-semibold',
                  statusFilter === opt.value
                    ? 'bg-primary-foreground/20 text-current'
                    : 'bg-muted text-muted-foreground'
                )}>
                  {opt.count}
                </span>
              </button>
            ))}
          </div>

          {/* Department filter */}
          {departments.length > 1 && (
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="rounded-full border border-border/70 bg-background/70 px-3 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Todos los deptos.</option>
              {departments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <SlidersHorizontal className="size-4" />
            Vista actual
          </div>
          <Badge variant="outline" className="rounded-full">
            Estado: {statusOptions.find((opt) => opt.value === statusFilter)?.label ?? 'Todos'}
          </Badge>
          {selectedDepartment && (
            <Badge variant="secondary" className="rounded-full">
              Depto: {selectedDepartment}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
