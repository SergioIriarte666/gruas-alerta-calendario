
import { ReportMetrics, ReportFilters } from '@/hooks/useReports';
import { Settings } from '@/types/settings';
import { Service } from '@/types';
import { CostCategory, Cost } from '@/types/costs';
import { MaintenanceReportData, MaintenanceReportFilters } from '@/hooks/reports/useMaintenanceReport';
import { Commission } from '@/types/commissions';

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

export interface AppliedCostFilters {
  dateRange: {
    from: string;
    to: string;
  };
  categoryId: string;
  categoryName?: string;
  craneId: string;
  craneName?: string;
  operatorId: string;
  operatorName?: string;
}

export interface ExportCostReportArgs {
  format: 'pdf' | 'excel';
  costs: Cost[];
  settings: Settings;
  appliedFilters: AppliedCostFilters;
}

export interface ExportMaintenanceReportArgs {
  format: 'pdf' | 'excel';
  data: MaintenanceReportData;
  settings: Settings;
  appliedFilters: MaintenanceReportFilters;
  filterLabels: string[][];
}

export interface AppliedCommissionFilters {
  status?: string;
  operatorId?: string;
  operatorName?: string;
  clientName?: string;
  dateFrom?: string;
  dateTo?: string;
  paymentDateFrom?: string; // Filtro por fecha de pago
  paymentDateTo?: string; // Filtro por fecha de pago
  amountFrom?: number;
  amountTo?: number;
}

export interface ExportCommissionReportArgs {
  format: 'pdf' | 'excel';
  commissions: Commission[];
  settings: Settings;
  appliedFilters: AppliedCommissionFilters;
}
