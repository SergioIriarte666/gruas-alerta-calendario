import { Button } from '@/components/ui/button';

export type ClientStatusFilter = 'all' | 'active' | 'inactive' | 'multi-department';

interface ClientsQuickFiltersProps {
  selected: ClientStatusFilter;
  onChange: (filter: ClientStatusFilter) => void;
  multiDepartmentCount: number;
}

export const ClientsQuickFilters = ({ selected, onChange, multiDepartmentCount }: ClientsQuickFiltersProps) => {
  const filters: { key: ClientStatusFilter; label: string; badge?: number }[] = [
    { key: 'all', label: 'Todos' },
    { key: 'active', label: 'Activos' },
    { key: 'inactive', label: 'Inactivos' },
    { key: 'multi-department', label: 'Multi-departamento', badge: multiDepartmentCount },
  ];

  return (
    <div className="flex flex-wrap gap-2">
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
          {filter.badge !== undefined && filter.badge > 0 && (
            <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${
              selected === filter.key 
                ? 'bg-white/20 text-white' 
                : 'bg-violet-100 text-violet-700'
            }`}>
              {filter.badge}
            </span>
          )}
        </Button>
      ))}
    </div>
  );
};
