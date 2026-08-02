import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import DatePickerInput from '@/components/common/DatePickerInput';
import { RegenerarInspeccionFilters as Filters } from '@/types/regenerar-inspeccion';

interface RegenerarInspeccionFiltersProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

export const RegenerarInspeccionFilters = ({ filters, onChange }: RegenerarInspeccionFiltersProps) => {
  const update = (key: keyof Filters, value: string) => onChange({ ...filters, [key]: value });

  return (
    <div className="configuration-filter-panel grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-3">
      <div className="space-y-2">
        <Label htmlFor="filtro-folio">Folio</Label>
        <Input
          id="filtro-folio"
          value={filters.folio}
          onChange={(event) => update('folio', event.target.value)}
          placeholder="Buscar folio"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="filtro-fecha">Fecha</Label>
        <DatePickerInput
          id="filtro-fecha"
          value={filters.fecha}
          onChange={(value) => update('fecha', value)}
          placeholder="Todas las fechas"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="filtro-cliente">Cliente</Label>
        <Input
          id="filtro-cliente"
          value={filters.cliente}
          onChange={(event) => update('cliente', event.target.value)}
          placeholder="Buscar cliente"
        />
      </div>
    </div>
  );
};
