
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
    // Función de normalización para búsqueda flexible
    const normalizeSearchTerm = (text: string): string => {
      return text.toLowerCase().replace(/[-\s_]/g, '').trim();
    };

    // Normalizar el término de búsqueda una sola vez
    const normalizedSearchTerm = normalizeSearchTerm(basicFilters.searchTerm);

    return services.filter(service => {
      // Apply basic filters first con normalización
      const matchesSearch = normalizedSearchTerm === '' || (
        normalizeSearchTerm(service.folio || '').includes(normalizedSearchTerm) ||
        normalizeSearchTerm(service.client?.name || '').includes(normalizedSearchTerm) ||
        normalizeSearchTerm(service.licensePlate || '').includes(normalizedSearchTerm) ||
        normalizeSearchTerm(service.vehicleBrand || '').includes(normalizedSearchTerm) ||
        normalizeSearchTerm(service.quoteNumber || '').includes(normalizedSearchTerm) ||
        normalizeSearchTerm(service.purchaseOrderNumber || service.purchaseOrder || '').includes(normalizedSearchTerm) ||
        normalizeSearchTerm(service.invoiceNumeroFiscal || '').includes(normalizedSearchTerm)
      );

      const statusesToFilter = basicFilters.statusFilter === 'all' ? [] : basicFilters.statusFilter.split(',');
      const matchesBasicStatus = basicFilters.statusFilter === 'all' || statusesToFilter.includes(service.status);

      if (!matchesSearch || !matchesBasicStatus) return false;

      // Apply advanced filters con normalización
      if (filters.serviceTypeId && service.serviceType?.id !== filters.serviceTypeId) return false;
      if (filters.licensePlate && !normalizeSearchTerm(service.licensePlate || '').includes(normalizeSearchTerm(filters.licensePlate))) return false;
      if (filters.quoteNumber && !normalizeSearchTerm(service.quoteNumber || '').includes(normalizeSearchTerm(filters.quoteNumber))) return false;
      if (filters.purchaseOrderNumber && !normalizeSearchTerm(service.purchaseOrderNumber || service.purchaseOrder || '').includes(normalizeSearchTerm(filters.purchaseOrderNumber))) return false;
      if (filters.numeroFiscal && !normalizeSearchTerm(service.invoiceNumeroFiscal || '').includes(normalizeSearchTerm(filters.numeroFiscal))) return false;

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
