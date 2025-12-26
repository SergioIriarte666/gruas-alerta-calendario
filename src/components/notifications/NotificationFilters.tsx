import React from 'react';
import { Search, Filter, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { NotificationFilters as FiltersType, CATEGORY_CONFIG, PRIORITY_CONFIG, NotificationCategory, NotificationPriority } from '@/types/notifications';

interface NotificationFiltersProps {
  filters: FiltersType;
  onFiltersChange: (filters: FiltersType) => void;
  totalCount: number;
  filteredCount: number;
}

export const NotificationFilters: React.FC<NotificationFiltersProps> = ({
  filters,
  onFiltersChange,
  totalCount,
  filteredCount,
}) => {
  const hasActiveFilters = filters.category !== 'all' || filters.status !== 'all' || filters.priority !== 'all' || filters.search;

  const clearFilters = () => {
    onFiltersChange({
      category: 'all',
      status: 'all',
      priority: 'all',
      search: '',
    });
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar notificaciones..."
          value={filters.search || ''}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          className="pl-9 bg-background border-border"
        />
        {filters.search && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={() => onFiltersChange({ ...filters, search: '' })}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      {/* Filter Selects */}
      <div className="flex flex-wrap gap-3">
        {/* Category Filter */}
        <Select
          value={filters.category || 'all'}
          onValueChange={(value) => onFiltersChange({ ...filters, category: value as FiltersType['category'] })}
        >
          <SelectTrigger className="w-[160px] bg-background border-border">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {(Object.keys(CATEGORY_CONFIG) as NotificationCategory[]).map((key) => (
              <SelectItem key={key} value={key}>
                {CATEGORY_CONFIG[key].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status Filter */}
        <Select
          value={filters.status || 'all'}
          onValueChange={(value) => onFiltersChange({ ...filters, status: value as FiltersType['status'] })}
        >
          <SelectTrigger className="w-[140px] bg-background border-border">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="unread">No leídas</SelectItem>
            <SelectItem value="read">Leídas</SelectItem>
          </SelectContent>
        </Select>

        {/* Priority Filter */}
        <Select
          value={filters.priority?.toString() || 'all'}
          onValueChange={(value) => onFiltersChange({ 
            ...filters, 
            priority: value === 'all' ? 'all' : Number(value) as NotificationPriority 
          })}
        >
          <SelectTrigger className="w-[140px] bg-background border-border">
            <SelectValue placeholder="Prioridad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {([1, 2, 3, 4, 5] as NotificationPriority[]).map((priority) => (
              <SelectItem key={priority} value={priority.toString()}>
                {PRIORITY_CONFIG[priority].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4 mr-1" />
            Limpiar filtros
          </Button>
        )}
      </div>

      {/* Results count */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Filter className="w-4 h-4" />
        <span>
          Mostrando {filteredCount} de {totalCount} notificaciones
        </span>
        {hasActiveFilters && (
          <Badge variant="secondary" className="ml-2">
            Filtros activos
          </Badge>
        )}
      </div>
    </div>
  );
};
