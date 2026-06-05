import { useCallback, useMemo, useState } from 'react';
import { CalendarIcon, SearchIcon, TagIcon, UserIcon } from 'lucide-react';
import { Filters, Filter, FilterFieldConfig, createFilter } from '@/components/reui/filters';
import { Input } from '@/components/ui/input';
import { useOperators } from '@/hooks/useOperators';
import { AdvancedFilters } from '@/hooks/useAdvancedFilters';

interface ServiceFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  onAdvancedFiltersChange: (filters: AdvancedFilters | null) => void;
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'in_progress', label: 'En Progreso' },
  { value: 'completed', label: 'Completado' },
  { value: 'cancelled', label: 'Cancelado' },
  { value: 'invoiced', label: 'Facturado' },
  { value: 'quoted', label: 'Cotizado' },
  { value: 'purchase_order_pending', label: 'Esperando O.C.' },
  { value: 'with_purchase_order', label: 'Con O.C.' },
  { value: 'failed', label: 'Fallido' },
];

const ES_I18N = {
  addFilter: 'Filtrar',
  searchFields: 'Buscar filtro...',
  noFieldsFound: 'No se encontraron filtros.',
  noResultsFound: 'Sin resultados.',
  select: 'Seleccionar...',
  true: 'Verdadero',
  false: 'Falso',
  min: 'Min',
  max: 'Max',
  to: 'a',
  typeAndPressEnter: 'Escribe y presiona Enter',
  selected: 'seleccionado',
  selectedCount: 'seleccionados',
  percent: '%',
  defaultCurrency: '$',
  defaultColor: '#000000',
  addFilterTitle: 'Agregar filtro',
  operators: {
    is: 'es',
    isNot: 'no es',
    isAnyOf: 'es cualquiera de',
    isNotAnyOf: 'no es ninguno de',
    includesAll: 'incluye todos',
    excludesAll: 'excluye todos',
    before: 'antes de',
    after: 'después de',
    between: 'entre',
    notBetween: 'no entre',
    contains: 'contiene',
    notContains: 'no contiene',
    startsWith: 'comienza con',
    endsWith: 'termina con',
    isExactly: 'es exactamente',
    equals: 'igual a',
    notEquals: 'diferente de',
    greaterThan: 'mayor que',
    lessThan: 'menor que',
    overlaps: 'se superpone',
    includes: 'incluye',
    excludes: 'excluye',
    includesAllOf: 'incluye todos de',
    includesAnyOf: 'incluye cualquiera de',
    empty: 'está vacío',
    notEmpty: 'no está vacío',
  },
  placeholders: {
    enterField: (fieldType: string) => `Ingresar ${fieldType}...`,
    selectField: 'Seleccionar...',
    searchField: (fieldName: string) => `Buscar ${fieldName.toLowerCase()}...`,
    enterKey: 'Ingresar clave...',
    enterValue: 'Ingresar valor...',
  },
  helpers: {
    formatOperator: (op: string) => op.replace(/_/g, ' '),
  },
  validation: {
    invalidEmail: 'Email inválido',
    invalidUrl: 'URL inválida',
    invalidTel: 'Teléfono inválido',
    invalid: 'Formato inválido',
  },
};

function DateRangeRenderer({
  values,
  onChange,
}: {
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const [from, to] = values;
  return (
    <div className="flex items-center gap-1 px-2">
      <Input
        type="date"
        className="h-7 w-32 border-0 p-0 text-xs shadow-none focus-visible:ring-0"
        value={from || ''}
        onChange={(e) => onChange([e.target.value, to || ''])}
      />
      <span className="text-muted-foreground text-xs">–</span>
      <Input
        type="date"
        className="h-7 w-32 border-0 p-0 text-xs shadow-none focus-visible:ring-0"
        value={to || ''}
        onChange={(e) => onChange([from || '', e.target.value])}
      />
    </div>
  );
}

export const ServiceFilters = ({
  onSearchChange,
  onStatusChange,
  onAdvancedFiltersChange,
}: ServiceFiltersProps) => {
  const { operators } = useOperators();
  const [filters, setFilters] = useState<Filter[]>([]);

  const operatorOptions = useMemo(
    () => operators.map((op) => ({ value: op.id, label: op.name })),
    [operators]
  );

  const fields = useMemo<FilterFieldConfig[]>(
    () => [
      {
        key: 'search',
        label: 'Búsqueda',
        icon: <SearchIcon className="size-3.5" />,
        type: 'text',
        placeholder: 'Folio, cliente, patente...',
        defaultOperator: 'contains',
        operators: [
          { value: 'contains', label: 'contiene' },
          { value: 'starts_with', label: 'comienza con' },
          { value: 'is', label: 'es exactamente' },
        ],
      },
      {
        key: 'status',
        label: 'Estado',
        icon: <TagIcon className="size-3.5" />,
        type: 'multiselect',
        searchable: false,
        options: STATUS_OPTIONS,
        defaultOperator: 'is_any_of',
        operators: [
          { value: 'is_any_of', label: 'es cualquiera de' },
          { value: 'is_not_any_of', label: 'no es ninguno de' },
        ],
      },
      {
        key: 'dateRange',
        label: 'Fecha',
        icon: <CalendarIcon className="size-3.5" />,
        type: 'custom',
        defaultOperator: 'between',
        operators: [{ value: 'between', label: 'entre' }],
        customRenderer: ({ values, onChange }) => (
          <DateRangeRenderer
            values={values as string[]}
            onChange={onChange as (v: string[]) => void}
          />
        ),
      },
      {
        key: 'operator',
        label: 'Operador',
        icon: <UserIcon className="size-3.5" />,
        type: 'select',
        searchable: true,
        options: operatorOptions,
        defaultOperator: 'is',
        operators: [
          { value: 'is', label: 'es' },
          { value: 'is_not', label: 'no es' },
        ],
      },
    ],
    [operatorOptions]
  );

  const syncCallbacks = useCallback(
    (newFilters: Filter[]) => {
      const searchFilter = newFilters.find((f) => f.field === 'search');
      const statusFilter = newFilters.find((f) => f.field === 'status');
      const dateFilter = newFilters.find((f) => f.field === 'dateRange');
      const operatorFilter = newFilters.find((f) => f.field === 'operator');

      onSearchChange((searchFilter?.values[0] as string) || '');
      onStatusChange(
        statusFilter && statusFilter.values.length > 0
          ? (statusFilter.values as string[]).join(',')
          : 'all'
      );

      const advanced: AdvancedFilters = {};
      if (dateFilter?.values[0])
        advanced.dateFrom = new Date(dateFilter.values[0] as string);
      if (dateFilter?.values[1])
        advanced.dateTo = new Date(dateFilter.values[1] as string);
      if (operatorFilter?.values[0])
        advanced.operatorId = operatorFilter.values[0] as string;

      onAdvancedFiltersChange(Object.keys(advanced).length > 0 ? advanced : null);
    },
    [onSearchChange, onStatusChange, onAdvancedFiltersChange]
  );

  const handleFiltersChange = useCallback(
    (newFilters: Filter[]) => {
      setFilters(newFilters);
      syncCallbacks(newFilters);
    },
    [syncCallbacks]
  );

  return (
    <Filters
      filters={filters}
      fields={fields}
      onChange={handleFiltersChange}
      i18n={ES_I18N}
      allowMultiple={true}
      size="default"
    />
  );
};
