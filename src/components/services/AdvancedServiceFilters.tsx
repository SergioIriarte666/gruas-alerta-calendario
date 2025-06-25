
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { AdvancedFilters } from '@/hooks/useAdvancedFilters';
import { useClients } from '@/hooks/useClients';
import { useServiceTypes } from '@/hooks/useServiceTypes';
import { useOperators } from '@/hooks/useOperators';
import { useCranes } from '@/hooks/useCranes';

interface AdvancedServiceFiltersProps {
  isOpen: boolean;
  onClose: () => void;
  filters: AdvancedFilters;
  onFiltersChange: (filters: AdvancedFilters) => void;
  onApply: () => void;
  onClear: () => void;
}

export const AdvancedServiceFilters: React.FC<AdvancedServiceFiltersProps> = ({
  isOpen,
  onClose,
  filters,
  onFiltersChange,
  onApply,
  onClear
}) => {
  const { clients } = useClients();
  const { serviceTypes } = useServiceTypes();
  const { operators } = useOperators();
  const { cranes } = useCranes();

  const handleDateSelect = (field: keyof AdvancedFilters, date: Date | undefined) => {
    onFiltersChange({
      ...filters,
      [field]: date ? format(date, 'yyyy-MM-dd') : undefined
    });
  };

  const handleInputChange = (field: keyof AdvancedFilters, value: string) => {
    onFiltersChange({
      ...filters,
      [field]: value || undefined
    });
  };

  const handleSelectChange = (field: keyof AdvancedFilters, value: string) => {
    onFiltersChange({
      ...filters,
      [field]: value === 'all' ? undefined : value
    });
  };

  const handleNumberChange = (field: keyof AdvancedFilters, value: string) => {
    onFiltersChange({
      ...filters,
      [field]: value ? parseFloat(value) : undefined
    });
  };

  const handleApply = () => {
    onApply();
    onClose();
  };

  const handleClear = () => {
    onClear();
    onClose();
  };

  const DatePicker = ({ field, label, value }: { field: keyof AdvancedFilters; label: string; value?: string }) => (
    <div className="space-y-2">
      <Label className="text-white">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal bg-black border-tms-green/30 text-white",
              !value && "text-gray-400"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? format(new Date(value), 'dd/MM/yyyy') : 'Seleccionar fecha'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-white" align="start">
          <Calendar
            mode="single"
            selected={value ? new Date(value) : undefined}
            onSelect={(date) => handleDateSelect(field, date)}
            initialFocus
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-black text-white border-tms-green">
        <DialogHeader>
          <DialogTitle className="text-white">Filtros Avanzados</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Fechas */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-tms-green">Fechas</h3>
            <DatePicker 
              field="requestDateFrom" 
              label="Fecha Solicitud Desde" 
              value={filters.requestDateFrom} 
            />
            <DatePicker 
              field="requestDateTo" 
              label="Fecha Solicitud Hasta" 
              value={filters.requestDateTo} 
            />
            <DatePicker 
              field="serviceDateFrom" 
              label="Fecha Servicio Desde" 
              value={filters.serviceDateFrom} 
            />
            <DatePicker 
              field="serviceDateTo" 
              label="Fecha Servicio Hasta" 
              value={filters.serviceDateTo} 
            />
          </div>

          {/* Recursos */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-tms-green">Recursos</h3>
            
            <div className="space-y-2">
              <Label className="text-white">Cliente</Label>
              <Select value={filters.clientId || 'all'} onValueChange={(value) => handleSelectChange('clientId', value)}>
                <SelectTrigger className="bg-black border-tms-green/30 text-white">
                  <SelectValue placeholder="Seleccionar cliente" />
                </SelectTrigger>
                <SelectContent className="bg-white text-black">
                  <SelectItem value="all">Todos los clientes</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-white">Tipo de Servicio</Label>
              <Select value={filters.serviceTypeId || 'all'} onValueChange={(value) => handleSelectChange('serviceTypeId', value)}>
                <SelectTrigger className="bg-black border-tms-green/30 text-white">
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent className="bg-white text-black">
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  {serviceTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-white">Operador</Label>
              <Select value={filters.operatorId || 'all'} onValueChange={(value) => handleSelectChange('operatorId', value)}>
                <SelectTrigger className="bg-black border-tms-green/30 text-white">
                  <SelectValue placeholder="Seleccionar operador" />
                </SelectTrigger>
                <SelectContent className="bg-white text-black">
                  <SelectItem value="all">Todos los operadores</SelectItem>
                  {operators.map((operator) => (
                    <SelectItem key={operator.id} value={operator.id}>
                      {operator.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-white">Grúa</Label>
              <Select value={filters.craneId || 'all'} onValueChange={(value) => handleSelectChange('craneId', value)}>
                <SelectTrigger className="bg-black border-tms-green/30 text-white">
                  <SelectValue placeholder="Seleccionar grúa" />
                </SelectTrigger>
                <SelectContent className="bg-white text-black">
                  <SelectItem value="all">Todas las grúas</SelectItem>
                  {cranes.map((crane) => (
                    <SelectItem key={crane.id} value={crane.id}>
                      {crane.brand} {crane.model} - {crane.licensePlate}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Vehículo y Financiero */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-tms-green">Vehículo</h3>
            
            <div className="space-y-2">
              <Label className="text-white">Marca</Label>
              <Input
                placeholder="Filtrar por marca"
                value={filters.vehicleBrand || ''}
                onChange={(e) => handleInputChange('vehicleBrand', e.target.value)}
                className="bg-black border-tms-green/30 text-white placeholder-gray-400"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white">Modelo</Label>
              <Input
                placeholder="Filtrar por modelo"
                value={filters.vehicleModel || ''}
                onChange={(e) => handleInputChange('vehicleModel', e.target.value)}
                className="bg-black border-tms-green/30 text-white placeholder-gray-400"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white">Patente</Label>
              <Input
                placeholder="Filtrar por patente"
                value={filters.licensePlate || ''}
                onChange={(e) => handleInputChange('licensePlate', e.target.value)}
                className="bg-black border-tms-green/30 text-white placeholder-gray-400"
              />
            </div>

            <h3 className="text-lg font-semibold text-tms-green mt-6">Financiero</h3>
            
            <div className="space-y-2">
              <Label className="text-white">Valor Mínimo</Label>
              <Input
                type="number"
                placeholder="0"
                value={filters.valueMin || ''}
                onChange={(e) => handleNumberChange('valueMin', e.target.value)}
                className="bg-black border-tms-green/30 text-white placeholder-gray-400"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white">Valor Máximo</Label>
              <Input
                type="number"
                placeholder="1000000"
                value={filters.valueMax || ''}
                onChange={(e) => handleNumberChange('valueMax', e.target.value)}
                className="bg-black border-tms-green/30 text-white placeholder-gray-400"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-4 mt-6 pt-6 border-t border-gray-700">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-gray-600 text-gray-300 hover:bg-gray-800"
          >
            Cancelar
          </Button>
          <Button
            variant="outline"
            onClick={handleClear}
            className="border-red-600 text-red-400 hover:bg-red-900/20"
          >
            Limpiar Filtros
          </Button>
          <Button
            onClick={handleApply}
            className="bg-tms-green text-black hover:bg-tms-green/80"
          >
            Aplicar Filtros
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
