
import React, { useState, useMemo } from 'react';
import { FormControl } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { Service } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { parseFromDatabase } from '@/utils/timezoneUtils';

interface ServiceSelectorProps {
  services: Service[];
  value: string;
  onValueChange: (value: string) => void;
  isLoading: boolean;
}

export const ServiceSelector = ({ services, value, onValueChange, isLoading }: ServiceSelectorProps) => {
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
    return `${service.folio} - ${service.client.name} - ${formattedDate}`;
  };

  return (
    <Select onValueChange={onValueChange} value={value ?? 'none'} disabled={isLoading}>
      <FormControl>
        <SelectTrigger className="bg-white/10">
          <SelectValue placeholder="Sin asociar" />
        </SelectTrigger>
      </FormControl>
      <SelectContent>
        {/* Campo de búsqueda */}
        <div className="p-2 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar por folio, cliente o fecha..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-8 text-sm bg-white border-gray-300"
            />
          </div>
        </div>
        
        <SelectItem value="none">Sin asociar</SelectItem>
        
        {filteredServices.length === 0 && searchTerm ? (
          <div className="p-2 text-sm text-gray-500 text-center">
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
          <div className="p-2 text-sm text-gray-500 text-center">
            No hay servicios disponibles
          </div>
        )}
      </SelectContent>
    </Select>
  );
};
