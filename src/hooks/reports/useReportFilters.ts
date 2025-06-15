
import { useState } from 'react';
import { ReportFilters as ReportFiltersType } from '@/hooks/useReports';

const defaultFilters: ReportFiltersType = {
  dateRange: {
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  },
  clientId: 'all',
  craneId: 'all',
  operatorId: 'all',
  costCategoryId: 'all',
};

const defaultServiceReportFilters = {
    dateRange: {
      from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
      to: new Date().toISOString().split('T')[0]
    },
    clientId: 'all',
};

export const useReportFilters = () => {
  const [filters, setFilters] = useState<ReportFiltersType>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<ReportFiltersType>(defaultFilters);
  const [serviceReportFilters, setServiceReportFilters] = useState(defaultServiceReportFilters);

  const handleDateChange = (field: 'from' | 'to', value: string) => {
    setFilters(prev => ({ ...prev, dateRange: { ...prev.dateRange, [field]: value } }));
  };

  const handleFilterChange = (field: 'clientId' | 'craneId' | 'operatorId' | 'costCategoryId', value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleServiceReportDateChange = (field: 'from' | 'to', value: string) => {
    setServiceReportFilters(prev => ({ ...prev, dateRange: { ...prev.dateRange, [field]: value } }));
  };

  const handleServiceReportFilterChange = (field: 'clientId', value: string) => {
    setServiceReportFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleUpdate = () => {
    setAppliedFilters(filters);
  };
  
  const handleClearFilters = () => {
    setFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
  };
  
  return {
    filters,
    appliedFilters,
    serviceReportFilters,
    handleDateChange,
    handleFilterChange,
    handleServiceReportDateChange,
    handleServiceReportFilterChange,
    handleUpdate,
    handleClearFilters,
  };
};
