
// Re-export functions from refactored modules for backward compatibility
export { exportOperationalReport as exportReport } from './reports/operationalReportExporter';
export { exportServiceReport } from './reports/serviceReportExporter';
export type { ExportReportArgs, ExportServiceReportArgs, AppliedServiceFilters } from './reports/reportTypes';
