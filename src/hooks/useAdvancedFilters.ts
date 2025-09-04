
import { useState, useMemo } from 'react';
import { Service } from '@/types';

export interface AdvancedFilters {
  serviceTypeId?: string;
  licensePlate?: string;
  quoteNumber?: string;
  purchaseOrderNumber?: string;
  numeroFiscal?: string;
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
        service.vehicleBrand.toLowerCase().includes(basicFilters.searchTerm.toLowerCase()) ||
        (service.quoteNumber || '').toLowerCase().includes(basicFilters.searchTerm.toLowerCase()) ||
        (service.purchaseOrderNumber || service.purchaseOrder || '').toLowerCase().includes(basicFilters.searchTerm.toLowerCase()) ||
        (service.invoiceNumeroFiscal || '').toLowerCase().includes(basicFilters.searchTerm.toLowerCase());

      const statusesToFilter = basicFilters.statusFilter === 'all' ? [] : basicFilters.statusFilter.split(',');
      const matchesBasicStatus = basicFilters.statusFilter === 'all' || statusesToFilter.includes(service.status);

      if (!matchesSearch || !matchesBasicStatus) return false;

      // Apply advanced filters
      if (filters.serviceTypeId && service.serviceType?.id !== filters.serviceTypeId) return false;
      if (filters.licensePlate && !service.licensePlate.toLowerCase().includes(filters.licensePlate.toLowerCase())) return false;
      if (filters.quoteNumber && !(service.quoteNumber || '').toLowerCase().includes(filters.quoteNumber.toLowerCase())) return false;
      if (filters.purchaseOrderNumber && !(service.purchaseOrderNumber || service.purchaseOrder || '').toLowerCase().includes(filters.purchaseOrderNumber.toLowerCase())) return false;
      if (filters.numeroFiscal && !(service.invoiceNumeroFiscal || '').toLowerCase().includes(filters.numeroFiscal.toLowerCase())) return false;

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
