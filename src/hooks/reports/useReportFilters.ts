import * as React from 'react';
import { ReportFilters as ReportFiltersType } from '@/hooks/useReports';

import { getCurrentMonthRange, formatForInput } from '@/utils/timezoneUtils';

const getCurrentMonthDates = () => {
  const { start, end } = getCurrentMonthRange();
  return {
    from: formatForInput(start),
    to: formatForInput(end)
  };
};

const defaultFilters: ReportFiltersType = {
  dateRange: getCurrentMonthDates(),
  clientId: 'all',
  department: 'all',
  craneId: 'all',
  operatorId: 'all',
  costCategoryId: 'all',
  companyRut: 'all',
};

const defaultServiceReportFilters = {
    dateRange: getCurrentMonthDates(),
    clientId: 'all',
};

const defaultCostReportFilters = {
    dateRange: getCurrentMonthDates(),
    categoryId: 'all',
    craneId: 'all',
    operatorId: 'all',
};

export const useReportFilters = () => {
  const [filters, setFilters] = React.useState<ReportFiltersType>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = React.useState<ReportFiltersType>(defaultFilters);
  const [serviceReportFilters, setServiceReportFilters] = React.useState(defaultServiceReportFilters);
  const [costReportFilters, setCostReportFilters] = React.useState(defaultCostReportFilters);

  const handleDateChange = (field: 'from' | 'to', value: string) => {
    setFilters(prev => ({ ...prev, dateRange: { ...prev.dateRange, [field]: value } }));
  };

  const handleFilterChange = (field: 'clientId' | 'department' | 'craneId' | 'operatorId' | 'costCategoryId' | 'companyRut', value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleServiceReportDateChange = (field: 'from' | 'to', value: string) => {
    setServiceReportFilters(prev => ({ ...prev, dateRange: { ...prev.dateRange, [field]: value } }));
  };

  const handleServiceReportFilterChange = (field: 'clientId', value: string) => {
    setServiceReportFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleCostReportDateChange = (field: 'from' | 'to', value: string) => {
    setCostReportFilters(prev => ({ ...prev, dateRange: { ...prev.dateRange, [field]: value } }));
  };

  const handleCostReportFilterChange = (field: 'categoryId' | 'craneId' | 'operatorId', value: string) => {
    setCostReportFilters(prev => ({ ...prev, [field]: value }));
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
    costReportFilters,
    handleDateChange,
    handleFilterChange,
    handleServiceReportDateChange,
    handleServiceReportFilterChange,
    handleCostReportDateChange,
    handleCostReportFilterChange,
    handleUpdate,
    handleClearFilters,
  };
};
