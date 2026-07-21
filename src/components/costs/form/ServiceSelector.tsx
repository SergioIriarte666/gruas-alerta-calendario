
import React, { useState, useMemo } from 'react';
import { FormControl } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { Service } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { parseFromDatabase } from '@/utils/timezoneUtils';
import { toTitleCase } from '@/lib/utils';

interface ServiceSelectorProps {
  services: Service[];
  value: string;
  onValueChange: (value: string) => void;
  isLoading: boolean;
  disabled?: boolean;
}

export const ServiceSelector = ({ services, value, onValueChange, isLoading, disabled = false }: ServiceSelectorProps) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Filtrar servicios basado en el término de búsqueda
  const filteredServices = useMemo(() => {
    if (!searchTerm) return services;
    
    const searchLower = searchTerm.toLowerCase();
    return services.filter(service => 
      service.folio.toLowerCase().includes(searchLower) ||
      service.client.name.toLowerCase().includes(searchLower) ||
      format(parseFromDatabase(service.serviceDate), 'dd/MM/yyyy', { locale: es }).includes(searchLower)
    );
  }, [services, searchTerm]);

  // Formatear texto del servicio para mostrar en el dropdown
  const formatServiceDisplay = (service: Service) => {
    const formattedDate = format(parseFromDatabase(service.serviceDate), 'dd/MM/yyyy', { locale: es });
    return `${service.folio} - ${toTitleCase(service.client.name)} - ${formattedDate}`;
  };

  return (
    <Select onValueChange={onValueChange} value={value ?? 'none'} disabled={isLoading || disabled}>
      <FormControl>
        <SelectTrigger className="bg-background/70">
          <SelectValue placeholder="Sin asociar" />
        </SelectTrigger>
      </FormControl>
      <SelectContent>
        {/* Campo de búsqueda */}
        <div className="border-b border-border p-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por folio, cliente o fecha..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 border-input bg-background pl-8 text-sm"
            />
          </div>
        </div>
        
        <SelectItem value="none">Sin asociar</SelectItem>
        
        {filteredServices.length === 0 && searchTerm ? (
          <div className="p-2 text-center text-sm text-muted-foreground">
            No se encontraron servicios
          </div>
        ) : (
          filteredServices.map(service => (
            <SelectItem key={service.id} value={service.id}>
              {formatServiceDisplay(service)}
            </SelectItem>
          ))
        )}
        
        {services.length === 0 && !isLoading && (
          <div className="p-2 text-center text-sm text-muted-foreground">
            No hay servicios disponibles
          </div>
        )}
      </SelectContent>
    </Select>
  );
};
