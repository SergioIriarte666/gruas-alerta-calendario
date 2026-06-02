import { useState } from 'react';
import { toast } from 'sonner';
import { useSettings } from '@/hooks/useSettings';
import { exportServiceReport } from '@/utils/reports/serviceReportExporter';
import { Service } from '@/types';
import { format as formatDate } from 'date-fns';
import { createLogger } from '@/lib/logger';

const logger = createLogger('ServicesPendingExport');

export const useServicesPendingExport = (services: Service[]) => {
  const [isExporting, setIsExporting] = useState(false);
  const { settings } = useSettings();

  const handleExportPendingServices = async () => {
    if (!settings) {
      toast.error('Error', { description: 'No se pudieron cargar los ajustes de la empresa' });
      return;
    }

    // Filter only pending services
    const pendingServices = services.filter(service => service.status === 'pending');

    if (pendingServices.length === 0) {
      toast.warning('Sin servicios pendientes', {
        description: 'No hay servicios con estado pendiente para exportar.'
      });
      return;
    }

    setIsExporting(true);
    
    try {
      const today = new Date();
      const formattedDate = formatDate(today, 'yyyy-MM-dd');
      
      await exportServiceReport({
        format: 'pdf',
        services: pendingServices,
        settings,
        appliedFilters: {
          dateRange: {
            from: formattedDate,
            to: formattedDate
          },
          client: 'Servicios Pendientes'
        },
        customFileName: `servicios-pendientes-${formattedDate}`
      } as any);

      toast.success('Exportación completada', {
        description: `Se exportaron ${pendingServices.length} servicios pendientes a PDF.`
      });
    } catch (error) {
      logger.error('Error exporting pending services:', error);
      toast.error('Error al exportar', {
        description: 'Hubo un problema al generar el PDF. Inténtalo de nuevo.'
      });
    } finally {
      setIsExporting(false);
    }
  };

  return {
    handleExportPendingServices,
    isExporting,
    pendingServicesCount: services.filter(service => service.status === 'pending').length
  };
};