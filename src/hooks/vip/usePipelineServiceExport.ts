import { useCallback, useMemo } from 'react';
import { useToast } from '@/components/ui/custom-toast';
import { useSettings } from '@/hooks/useSettings';
import { exportServiceReport } from '@/utils/reports/serviceReportExporter';
import { format, differenceInDays } from 'date-fns';
import { Service, ServiceStatus } from '@/types';
import { getDisplayServiceValue } from '@/utils/serviceValueCalculations';
import { parseFromDatabase } from '@/utils/timezoneUtils';
import { createLogger } from "@/lib/logger";
import { businessClock } from '@/utils/businessClock';


const logger = createLogger("usePipelineServiceExport");
interface PipelineExportOptions {
  includeStatuses?: ServiceStatus[];
  includeAllStatuses?: boolean;
}

export const usePipelineServiceExport = (
  services: Service[], 
  clientName: string,
  clientId: string
) => {
  const { toast } = useToast();
  const { settings } = useSettings();

  // Transformar servicios para el exportador
  const transformServices = useCallback((servicesToTransform: Service[]) => {
    return servicesToTransform.map(service => ({
      id: service.id,
      folio: service.folio,
      requestDate: service.serviceDate,
      serviceDate: service.serviceDate,
      client: {
        id: clientId,
        name: clientName,
        rut: service.client?.rut || '',
        phone: service.client?.phone || '',
        email: service.client?.email || '',
        address: service.client?.address || '',
        department: service.client?.department || '',
        isActive: true,
        createdAt: '',
        updatedAt: '',
      },
      vehicleBrand: service.vehicleBrand || '',
      vehicleModel: service.vehicleModel || '',
      licensePlate: service.licensePlate || '',
      origin: service.origin || '',
      destination: service.destination || '',
      serviceType: {
        id: service.serviceType.id,
        name: service.serviceType.name,
        isActive: true,
        vehicleInfoOptional: false,
        purchaseOrderRequired: false,
        originRequired: true,
        destinationRequired: true,
        craneRequired: true,
        operatorRequired: true,
        vehicleBrandRequired: false,
        vehicleModelRequired: false,
        licensePlateRequired: false,
        createdAt: '',
        updatedAt: '',
      },
      value: getDisplayServiceValue(service),
      crane: {
        id: service.crane?.id || '',
        licensePlate: service.crane?.licensePlate || '',
        brand: service.crane?.brand || '',
        model: service.crane?.model || '',
        type: 'medium' as const,
        circulationPermitExpiry: '',
        insuranceExpiry: '',
        technicalReviewExpiry: '',
        isActive: true,
        createdAt: '',
        updatedAt: '',
      },
      operator: {
        id: service.operator?.id || '',
        name: service.operator?.name || '',
        rut: service.operator?.rut || '',
        phone: service.operator?.phone || '',
        operatorType: (service.operator?.operatorType as 'crane_operator' | 'administrative') || 'crane_operator',
        licenseNumber: service.operator?.licenseNumber || '',
        examExpiry: service.operator?.examExpiry || '',
        isActive: true,
        createdAt: '',
        updatedAt: '',
      },
      operatorCommission: service.operatorCommission || 0,
      status: service.status,
      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
        // Campos adicionales específicos del pipeline
        quoteNumber: service.quoteNumber || '',
        purchaseOrder: service.purchaseOrderNumber || service.purchaseOrder || '',
        invoiceFolio: service.invoiceFolio || '',
        invoiceNumeroFiscal: service.invoiceNumeroFiscal || '',
        observations: service.observations || '',
      daysInStatus: differenceInDays(new Date(), parseFromDatabase(service.serviceDate)),
      hasExcess: service.hasExcess || false,
      clientCoveredAmount: service.clientCoveredAmount,
    }));
  }, [clientName, clientId]);

  // Calcular métricas del pipeline
  const pipelineMetrics = useMemo(() => {
    const statusGroups = services.reduce((acc, service) => {
      const status = service.status;
      if (!acc[status]) {
        acc[status] = {
          count: 0,
          totalValue: 0,
          services: []
        };
      }
      acc[status].count++;
      acc[status].totalValue += getDisplayServiceValue(service);
      acc[status].services.push(service);
      return acc;
    }, {} as Record<ServiceStatus, { count: number; totalValue: number; services: Service[] }>);

    return statusGroups;
  }, [services]);

  const exportToPDF = useCallback(async (options: PipelineExportOptions = {}) => {
    const { includeStatuses, includeAllStatuses = true } = options;
    
    let servicesToExport = services;
    let filterDescription = 'Todos los estados';

    if (!includeAllStatuses && includeStatuses && includeStatuses.length > 0) {
      servicesToExport = services.filter(service => includeStatuses.includes(service.status));
      filterDescription = includeStatuses.join(', ');
    }

    if (servicesToExport.length === 0) {
      toast({
        title: "Sin servicios",
        description: "No hay servicios para exportar con los filtros seleccionados.",
        type: "error",
      });
      return;
    }

    // Ordenar servicios por fecha (más antiguas primero)
    servicesToExport = [...servicesToExport].sort((a, b) => {
      const dateA = parseFromDatabase(a.serviceDate).getTime();
      const dateB = parseFromDatabase(b.serviceDate).getTime();
      return dateA - dateB;
    });

    try {
      toast({
        title: "Generando PDF...",
        description: "Por favor espere mientras se genera el reporte del pipeline.",
        type: "info",
      });

      // Calcular fechas del rango
      const dates = servicesToExport.map(s => parseFromDatabase(s.serviceDate));
      const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
      const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

      const currentDate = businessClock.today();
      const customFileName = `pipeline-vip-${clientName.toLowerCase().replace(/\s+/g, '-')}-${currentDate}`;

      // Transformar servicios
      const transformedServices = transformServices(servicesToExport);

      await exportServiceReport({
        services: transformedServices,
        settings: settings,
        appliedFilters: {
          dateRange: {
            from: format(minDate, 'yyyy-MM-dd'),
            to: format(maxDate, 'yyyy-MM-dd')
          },
          client: `${clientName} - ${filterDescription}`
        },
        format: 'pdf',
        customFileName,
      });

      toast({
        title: "PDF generado",
        description: `Reporte del pipeline exportado como ${customFileName}.pdf`,
        type: "success",
      });
    } catch (error) {
      logger.error('Error exporting pipeline to PDF:', error);
      toast({
        title: "Error",
        description: "Ocurrió un error al generar el PDF. Por favor intente nuevamente.",
        type: "error",
      });
    }
  }, [services, clientName, transformServices, settings, toast]);

  const exportToExcel = useCallback(async (options: PipelineExportOptions = {}) => {
    const { includeStatuses, includeAllStatuses = true } = options;
    
    let servicesToExport = services;
    let filterDescription = 'Todos los estados';

    if (!includeAllStatuses && includeStatuses && includeStatuses.length > 0) {
      servicesToExport = services.filter(service => includeStatuses.includes(service.status));
      filterDescription = includeStatuses.join(', ');
    }

    if (servicesToExport.length === 0) {
      toast({
        title: "Sin servicios",
        description: "No hay servicios para exportar con los filtros seleccionados.",
        type: "error",
      });
      return;
    }

    // Ordenar servicios por fecha (más antiguas primero)
    servicesToExport = [...servicesToExport].sort((a, b) => {
      const dateA = parseFromDatabase(a.serviceDate).getTime();
      const dateB = parseFromDatabase(b.serviceDate).getTime();
      return dateA - dateB;
    });

    try {
      toast({
        title: "Generando Excel...",
        description: "Por favor espere mientras se genera el reporte del pipeline.",
        type: "info",
      });

      // Calcular fechas del rango
      const dates = servicesToExport.map(s => parseFromDatabase(s.serviceDate));
      const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
      const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

      const currentDate = businessClock.today();
      const customFileName = `pipeline-vip-${clientName.toLowerCase().replace(/\s+/g, '-')}-${currentDate}`;

      // Transformar servicios
      const transformedServices = transformServices(servicesToExport);

      await exportServiceReport({
        services: transformedServices,
        settings: settings,
        appliedFilters: {
          dateRange: {
            from: format(minDate, 'yyyy-MM-dd'),
            to: format(maxDate, 'yyyy-MM-dd')
          },
          client: `${clientName} - ${filterDescription}`
        },
        format: 'excel',
        customFileName,
      });

      toast({
        title: "Excel generado",
        description: `Reporte del pipeline exportado como ${customFileName}.xlsx`,
        type: "success",
      });
    } catch (error) {
      logger.error('Error exporting pipeline to Excel:', error);
      toast({
        title: "Error",
        description: "Ocurrió un error al generar el Excel. Por favor intente nuevamente.",
        type: "error",
      });
    }
  }, [services, clientName, transformServices, settings, toast]);

  return {
    exportToPDF,
    exportToExcel,
    servicesCount: services.length,
    pipelineMetrics,
  };
};