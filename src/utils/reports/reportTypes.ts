
import { ReportMetrics, ReportFilters } from '@/hooks/useReports';
import { Settings } from '@/types/settings';
import { Service } from '@/types';
import { CostCategory } from '@/types/costs';

export interface ExportReportArgs {
  format: 'pdf' | 'excel';
  metrics: ReportMetrics;
  settings: Settings;
  appliedFilters: ReportFilters;
  filterLabels: string[][];
  costCategories: CostCategory[];
}

export interface AppliedServiceFilters {
  dateRange: {
    from: string;
    to: string;
  };
  client: string;
}

export interface ExportServiceReportArgs {
  format: 'pdf' | 'excel';
  services: Service[];
  settings: Settings;
  appliedFilters: AppliedServiceFilters;
}
