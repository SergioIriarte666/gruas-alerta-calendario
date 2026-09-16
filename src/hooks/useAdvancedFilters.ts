import { parseDateValue } from '@/utils/calendarDate';
import { useState, useMemo } from 'react';
import { Service } from '@/types';
import { parseFromDatabase } from '@/utils/timezoneUtils';

export interface AdvancedFilters {
  serviceTypeId?: string;
  licensePlate?: string;
  quoteNumber?: string;
  purchaseOrderNumber?: string;
  numeroFiscal?: string;
  dateFrom?: Date;
  dateTo?: Date;
  operatorId?: string;
}

export const useAdvancedFilters = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState<AdvancedFilters>({});

  const hasActiveFilters = useMemo(() => {
    return Object.entries(filters).some(([_key, value]) => {
      if (value === undefined || value === '') return false;
      if (value instanceof Date) return true;
      if (Array.isArray(value)) return value.length > 0;
      return true;
    });
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
      if (filters.operatorId && service.operator?.id !== filters.operatorId) return false;

      // Apply date filters
      if (filters.dateFrom || filters.dateTo) {
        const serviceDate = service.serviceDate ? parseFromDatabase(service.serviceDate) : null;
        if (!serviceDate) return false;
        
        if (filters.dateFrom) {
          const fromDate = parseDateValue(filters.dateFrom);
          fromDate.setHours(0, 0, 0, 0);
          if (serviceDate < fromDate) return false;
        }
        
        if (filters.dateTo) {
          const toDate = parseDateValue(filters.dateTo);
          toDate.setHours(23, 59, 59, 999);
          if (serviceDate > toDate) return false;
        }
      }

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
