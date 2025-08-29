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
    <div className="flex space-x-2 bg-gray-100 p-1 rounded-lg">
      {filters.map((filter) => (
        <Button
          key={filter.key}
          variant={selected === filter.key ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onChange(filter.key)}
          className={`
            transition-colors
            ${selected === filter.key 
              ? 'bg-white text-tms-green shadow-sm font-medium' 
              : 'hover:bg-gray-200 text-gray-600'
            }
          `}
        >
          {filter.label}
        </Button>
      ))}
    </div>
  );
};