
import React from 'react';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, CalendarDays, CalendarCheck } from 'lucide-react';

interface QuickDateFiltersProps {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  todayCount?: number;
}

export const QuickDateFilters = ({ 
  activeFilter, 
  onFilterChange, 
  todayCount = 0 
}: QuickDateFiltersProps) => {
  const filters = [
    { key: 'today', label: 'Hoy', icon: Clock, count: todayCount },
    { key: 'week', label: 'Esta Semana', icon: CalendarDays },
    { key: 'month', label: 'Este Mes', icon: Calendar },
    { key: 'all', label: 'Ver Todos', icon: CalendarCheck },
  ];

  return (
    <div className="flex gap-2 flex-wrap">
      {filters.map((filter) => {
        const Icon = filter.icon;
        const isActive = activeFilter === filter.key;
        
        return (
          <Button
            key={filter.key}
            variant={isActive ? 'default' : 'outline'}
            size="sm"
            onClick={() => onFilterChange(filter.key)}
            className={`
              ${isActive 
                ? 'bg-tms-green hover:bg-tms-green/80 text-white' 
                : 'border-gray-300 hover:bg-gray-50'
              }
              transition-all duration-200
            `}
          >
            <Icon className="size-4 mr-2" />
            {filter.label}
            {filter.count !== undefined && filter.count > 0 && (
              <span className={`
                ml-1 px-1.5 py-0.5 rounded-full text-xs
                ${isActive ? 'bg-white/20' : 'bg-gray-100'}
              `}>
                {filter.count}
              </span>
            )}
          </Button>
        );
      })}
    </div>
  );
};
