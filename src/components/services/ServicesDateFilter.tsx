import React from 'react';
import { Button } from '@/components/ui/button';

type DateFilter = 'today' | 'week' | 'month' | 'all';

interface ServicesDateFilterProps {
  selected: DateFilter;
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
    <div className="flex flex-shrink-0 space-x-1 overflow-x-auto rounded-lg border border-border bg-muted p-1 sm:space-x-2">
      {filters.map((filter) => (
        <Button
          key={filter.key}
          variant={selected === filter.key ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onChange(filter.key)}
          className={`
            transition-colors whitespace-nowrap text-xs sm:text-sm
            ${selected === filter.key 
              ? 'bg-primary text-primary-foreground shadow-sm font-medium' 
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