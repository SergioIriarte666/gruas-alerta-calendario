
import { useState, useMemo } from 'react';
import { Service } from '@/types';

export interface AdvancedFilters {
  requestDateFrom?: string;
  requestDateTo?: string;
  serviceDateFrom?: string;
  serviceDateTo?: string;
  clientId?: string;
  serviceTypeId?: string;
  operatorId?: string;
  craneId?: string;
  valueMin?: number;
  valueMax?: number;
  vehicleBrand?: string;
  vehicleModel?: string;
  licensePlate?: string;
  statuses?: string[];
}

export const useAdvancedFilters = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState<AdvancedFilters>({});

  const hasActiveFilters = useMemo(() => {
    return Object.values(filters).some(value => 
      value !== undefined && value !== '' && 
      (Array.isArray(value) ? value.length > 0 : true)
    );
  }, [filters]);

  const applyAdvancedFilters = (services: Service[], basicFilters: { searchTerm: string; statusFilter: string }) => {
    return services.filter(service => {
      // Apply basic filters first
      const matchesSearch = 
        service.folio.toLowerCase().includes(basicFilters.searchTerm.toLowerCase()) ||
        (service.client?.name || '').toLowerCase().includes(basicFilters.searchTerm.toLowerCase()) ||
        service.licensePlate.toLowerCase().includes(basicFilters.searchTerm.toLowerCase()) ||
        service.vehicleBrand.toLowerCase().includes(basicFilters.searchTerm.toLowerCase());

      const statusesToFilter = basicFilters.statusFilter === 'all' ? [] : basicFilters.statusFilter.split(',');
      const matchesBasicStatus = basicFilters.statusFilter === 'all' || statusesToFilter.includes(service.status);

      if (!matchesSearch || !matchesBasicStatus) return false;

      // Apply advanced filters
      if (filters.requestDateFrom && new Date(service.requestDate) < new Date(filters.requestDateFrom)) return false;
      if (filters.requestDateTo && new Date(service.requestDate) > new Date(filters.requestDateTo)) return false;
      if (filters.serviceDateFrom && new Date(service.serviceDate) < new Date(filters.serviceDateFrom)) return false;
      if (filters.serviceDateTo && new Date(service.serviceDate) > new Date(filters.serviceDateTo)) return false;
      
      if (filters.clientId && service.client?.id !== filters.clientId) return false;
      if (filters.serviceTypeId && service.serviceType?.id !== filters.serviceTypeId) return false;
      if (filters.operatorId && service.operator?.id !== filters.operatorId) return false;
      if (filters.craneId && service.crane?.id !== filters.craneId) return false;
      
      if (filters.valueMin && service.value < filters.valueMin) return false;
      if (filters.valueMax && service.value > filters.valueMax) return false;
      
      if (filters.vehicleBrand && !service.vehicleBrand.toLowerCase().includes(filters.vehicleBrand.toLowerCase())) return false;
      if (filters.vehicleModel && !service.vehicleModel.toLowerCase().includes(filters.vehicleModel.toLowerCase())) return false;
      if (filters.licensePlate && !service.licensePlate.toLowerCase().includes(filters.licensePlate.toLowerCase())) return false;
      
      if (filters.statuses && filters.statuses.length > 0 && !filters.statuses.includes(service.status)) return false;

      return true;
    });
  };

  const clearFilters = () => {
    setFilters({});
  };

  const updateFilters = (newFilters: Partial<AdvancedFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  return {
    isOpen,
    setIsOpen,
    filters,
    setFilters,
    hasActiveFilters,
    applyAdvancedFilters,
    clearFilters,
    updateFilters
  };
};
