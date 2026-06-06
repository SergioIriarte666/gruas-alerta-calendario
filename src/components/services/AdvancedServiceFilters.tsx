
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AdvancedFilters } from '@/hooks/useAdvancedFilters';
import { useServiceTypes } from '@/hooks/useServiceTypes';
import DateRangePicker from '@/components/closures/DateRangePicker';

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
  const { serviceTypes } = useServiceTypes();

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

  const handleApply = () => {
    onApply();
    onClose();
  };

  const handleClear = () => {
    onClear();
    onClose();
  };


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-clip">
        <DialogHeader>
          <DialogTitle className="text-foreground">Filtros Avanzados</DialogTitle>
        </DialogHeader>

        {/* Date Range Filter */}
        <div className="mb-6 pb-4 border-b">
          <Label className="text-foreground mb-3 block">Rango de Fechas</Label>
          <DateRangePicker
            dateFrom={filters.dateFrom}
            dateTo={filters.dateTo}
            onDateFromChange={(date) => onFiltersChange({ ...filters, dateFrom: date })}
            onDateToChange={(date) => onFiltersChange({ ...filters, dateTo: date })}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-foreground">Tipo de Servicio</Label>
              <Select value={filters.serviceTypeId || 'all'} onValueChange={(value) => handleSelectChange('serviceTypeId', value)}>
                <SelectTrigger className="bg-card border-border text-foreground">
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
              <Label className="text-foreground">Patente</Label>
              <Input
                placeholder="Filtrar por patente"
                value={filters.licensePlate || ''}
                onChange={(e) => handleInputChange('licensePlate', e.target.value)}
                className="bg-card border-border text-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-foreground">Número Fiscal</Label>
              <Input
                placeholder="Filtrar por número fiscal"
                value={filters.numeroFiscal || ''}
                onChange={(e) => handleInputChange('numeroFiscal', e.target.value)}
                className="bg-card border-border text-foreground"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-foreground">Número de Cotización</Label>
              <Input
                placeholder="Filtrar por cotización"
                value={filters.quoteNumber || ''}
                onChange={(e) => handleInputChange('quoteNumber', e.target.value)}
                className="bg-card border-border text-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-foreground">Orden de Compra</Label>
              <Input
                placeholder="Filtrar por O.C."
                value={filters.purchaseOrderNumber || ''}
                onChange={(e) => handleInputChange('purchaseOrderNumber', e.target.value)}
                className="bg-card border-border text-foreground"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-x-4 mt-6 pt-6 border-t">
          <Button
            variant="outline"
            onClick={onClose}
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
