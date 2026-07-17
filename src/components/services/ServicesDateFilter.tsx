import React from 'react';
import { Button } from '@/components/ui/button';

export type DateFilter = 'today' | 'week' | 'month' | 'all';

interface ServicesDateFilterProps {
  selected: DateFilter | 'custom';
  onChange: (filter: DateFilter) => void;
}

export const ServicesDateFilter = ({ selected, onChange }: ServicesDateFilterProps) => {
  const filters = [
    { key: 'today' as DateFilter, label: 'Hoy' },
    { key: 'week' as DateFilter, label: 'Esta Semana' },
    { key: 'month' as DateFilter, label: 'Este Mes' },
    { key: 'all' as DateFilter, label: 'Ver Todos' },
  ];

  return (
    <div className="services-period-filter flex max-w-full flex-shrink-0 gap-x-1 overflow-x-auto p-1">
      {filters.map((filter) => (
        <Button
          key={filter.key}
          variant="ghost"
          size="sm"
          onClick={() => onChange(filter.key)}
          className={`
            transition-colors whitespace-nowrap text-xs sm:text-sm
            ${selected === filter.key 
              ? 'services-period-filter__active font-medium shadow-sm'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }
          `}
        >
          {filter.label}
        </Button>
      ))}
    </div>
  );
};
