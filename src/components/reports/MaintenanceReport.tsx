import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMaintenanceReport, MaintenanceReportFilters } from '@/hooks/reports/useMaintenanceReport';
import { MaintenanceMetrics } from './maintenance/MaintenanceMetrics';
import { MaintenanceCharts } from './maintenance/MaintenanceCharts';
import { MaintenanceTables } from './maintenance/MaintenanceTables';
import { MaintenanceFilters } from './maintenance/MaintenanceFilters';
import { useState } from 'react';
import { format, formatDate } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Download, FileText, FileSpreadsheet } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useSettings } from '@/hooks/useSettings';
import { exportMaintenanceReport } from '@/utils/reportExporter';
import { useToast } from '@/components/ui/custom-toast';

const defaultFilters: MaintenanceReportFilters = {
  dateFrom: format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd'),
  dateTo: format(new Date(), 'yyyy-MM-dd'),
};

export const MaintenanceReport = () => {
  const [filters, setFilters] = useState<MaintenanceReportFilters>(defaultFilters);
  const { data, loading, error } = useMaintenanceReport(filters);
  const { settings } = useSettings();
  const { toast } = useToast();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-white">Generando reporte de mantenimiento...</div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="bg-card/50 border-border">
        <CardContent className="p-6">
          <div className="text-destructive">Error al cargar el reporte: {error}</div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="bg-card/50 border-border">
        <CardContent className="p-6">
          <div className="text-muted-foreground">No hay datos disponibles para el período seleccionado.</div>
        </CardContent>
      </Card>
    );
  }

  const getAppliedFilterLabels = () => {
    const labels: string[][] = [
      ['Período', `${formatDate(new Date(filters.dateFrom + 'T00:00:00'), 'P', { locale: es })} - ${formatDate(new Date(filters.dateTo + 'T00:00:00'), 'P', { locale: es })}`]
    ];
    
    if (filters.craneId) {
      labels.push(['Grúa', 'Grúa específica']);
    }
    
    if (filters.maintenanceType) {
      labels.push(['Tipo', filters.maintenanceType]);
    }
    
    if (filters.status) {
      labels.push(['Estado', filters.status]);
    }
    
    if (filters.provider) {
      labels.push(['Proveedor', filters.provider]);
    }
    
    return labels;
  };

  const handleExport = async (format: 'pdf' | 'excel') => {
    if (!data || !settings) {
      toast({
        title: "Error",
        description: "No hay datos disponibles para exportar",
        type: "error",
      });
      return;
    }

    try {
      const filterLabels = getAppliedFilterLabels();
      
      await exportMaintenanceReport({
        format,
        data,
        settings,
        appliedFilters: filters,
        filterLabels,
      });
      
      toast({
        title: "Exportación exitosa",
        description: `Reporte de mantenimiento exportado en formato ${format.toUpperCase()}`,
        type: "success",
      });
    } catch (error) {
      console.error('Error al exportar:', error);
      toast({
        title: "Error de exportación",
        description: "No se pudo exportar el reporte",
        type: "error",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Reporte de Mantenimiento y Partes</h2>
          <p className="text-gray-300 mt-1">
            Análisis detallado de costos de mantenimiento y gestión de partes.
          </p>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Exportar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => handleExport('pdf')}>
              <FileText className="h-4 w-4 mr-2" />
              Exportar PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('excel')}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Exportar Excel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Filters */}
      <MaintenanceFilters 
        filters={filters} 
        onFiltersChange={setFilters} 
      />

      {/* Metrics Overview */}
      <MaintenanceMetrics data={data} />

      {/* Charts */}
      <MaintenanceCharts data={data} />

      {/* Detailed Tables */}
      <MaintenanceTables data={data} />
    </div>
  );
};