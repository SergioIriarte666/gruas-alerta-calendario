import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { MaintenanceReportFilters } from '@/hooks/reports/useMaintenanceReport';
import { useCranes } from '@/hooks/useCranes';
import { RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import DatePickerInput from '@/components/common/DatePickerInput';

interface MaintenanceFiltersProps {
  filters: MaintenanceReportFilters;
  onFiltersChange: (filters: MaintenanceReportFilters) => void;
}

const maintenanceTypes = [
  'Preventivo',
  'Correctivo',
  'Predictivo',
  'Emergencia',
  'Revisión',
  'Calibración',
];

const statusOptions = [
  { value: 'scheduled', label: 'Programado' },
  { value: 'in_progress', label: 'En Progreso' },
  { value: 'completed', label: 'Completado' },
  { value: 'cancelled', label: 'Cancelado' },
];

export const MaintenanceFilters = ({ filters, onFiltersChange }: MaintenanceFiltersProps) => {
  const { cranes } = useCranes();

  const handleFilterChange = (key: keyof MaintenanceReportFilters, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value === 'all' ? undefined : value,
    });
  };

  const handleReset = () => {
    onFiltersChange({
      dateFrom: format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd'),
      dateTo: format(new Date(), 'yyyy-MM-dd'),
    });
  };

  return (
    <Card className="bg-card/50 border-border">
      <CardContent className="p-6">
        <div className="space-y-6">
          {/* Filtros de fecha - Primera fila */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dateFrom" className="text-sm text-black">
                Fecha Desde
              </Label>
              <DatePickerInput
                id="dateFrom"
                value={filters.dateFrom}
                onChange={(value) => handleFilterChange('dateFrom', value)}
                placeholder="Seleccionar fecha"
                className="h-10 bg-background/50 border-border"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateTo" className="text-sm text-black">
                Fecha Hasta
              </Label>
              <DatePickerInput
                id="dateTo"
                value={filters.dateTo}
                onChange={(value) => handleFilterChange('dateTo', value)}
                placeholder="Seleccionar fecha"
                className="h-10 bg-background/50 border-border"
              />
            </div>
          </div>

          {/* Filtros de selección - Segunda fila */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-sm text-black">Grúa</Label>
              <Select value={filters.craneId || 'all'} onValueChange={(value) => handleFilterChange('craneId', value)}>
                <SelectTrigger className="h-10 bg-background/50 border-border">
                  <SelectValue placeholder="Todas las grúas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las grúas</SelectItem>
                  {cranes?.map((crane) => (
                    <SelectItem key={crane.id} value={crane.id}>
                      {crane.licensePlate} - {crane.brand} {crane.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-black">Tipo de Mantenimiento</Label>
              <Select value={filters.maintenanceType || 'all'} onValueChange={(value) => handleFilterChange('maintenanceType', value)}>
                <SelectTrigger className="h-10 bg-background/50 border-border">
                  <SelectValue placeholder="Todos los tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  {maintenanceTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-black">Estado</Label>
              <Select value={filters.status || 'all'} onValueChange={(value) => handleFilterChange('status', value)}>
                <SelectTrigger className="h-10 bg-background/50 border-border">
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Filtro de proveedor y botón de limpiar - Tercera fila */}
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="gap-y-2 flex-1 max-w-sm">
              <Label htmlFor="provider" className="text-sm text-black">
                Proveedor
              </Label>
              <Input
                id="provider"
                type="text"
                placeholder="Buscar proveedor..."
                value={filters.provider || ''}
                onChange={(e) => handleFilterChange('provider', e.target.value)}
                className="h-10 bg-background/50 border-border placeholder:text-black"
              />
            </div>

            <Button
              variant="outline"
              onClick={handleReset}
              className="h-10 gap-2 shrink-0 px-6"
            >
              <RotateCcw className="size-4" />
              Limpiar Filtros
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};