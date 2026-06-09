import { useState, useEffect } from 'react';
import { createLogger } from "@/lib/logger";


const logger = createLogger("useProjectionFilters");
interface ProjectionFilters {
  dateRange: number;
  clientId: string | null;
  status: string[];
}

const STORAGE_KEY = 'income-projection-filters';

const defaultFilters: ProjectionFilters = {
  dateRange: 30,
  clientId: null,
  status: ['sent', 'partial', 'overdue'],
};

export const useProjectionFilters = () => {
  const [filters, setFilters] = useState<ProjectionFilters>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      logger.error('Error loading saved filters:', error);
    }
    return defaultFilters;
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
    } catch (error) {
      logger.error('Error saving filters:', error);
    }
  }, [filters]);

  const clearFilters = () => {
    setFilters(defaultFilters);
  };

  const hasActiveFilters = () => {
    return (
      filters.dateRange !== defaultFilters.dateRange ||
      filters.clientId !== defaultFilters.clientId ||
      JSON.stringify(filters.status) !== JSON.stringify(defaultFilters.status)
    );
  };

  return {
    filters,
    setDateRange: (dateRange: number) => setFilters(prev => ({ ...prev, dateRange })),
    setClientId: (clientId: string | null) => setFilters(prev => ({ ...prev, clientId })),
    setStatus: (status: string[]) => setFilters(prev => ({ ...prev, status })),
    clearFilters,
    hasActiveFilters: hasActiveFilters(),
  };
};
