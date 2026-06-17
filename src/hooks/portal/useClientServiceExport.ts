import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/components/ui/custom-toast';
import { useSettings } from '@/hooks/useSettings';
import { exportServiceReport } from '@/utils/reports/serviceReportExporter';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from "@/lib/logger";
import { businessClock } from '@/utils/businessClock';


const logger = createLogger("useClientServiceExport");
interface ClientService {
  id: string;
  folio: string;
  service_date: string;
  status: string;
  origin: string;
  destination: string;
  value: number;
  crane_license_plate: string;
  operator_name: string;
  service_type_name: string;
  client_name?: string;
  vehicle_brand?: string;
  vehicle_model?: string;
  license_plate?: string;
}

const fetchClientServicesForExport = async (clientId: string): Promise<ClientService[]> => {
  if (!clientId) {
    throw new Error('Client ID is required');
  }

  const { data, error } = await supabase
    .from('services')
    .select(`
      id,
      folio,
      service_date,
      status,
      origin,
      destination,
      value,
      license_plate,
      vehicle_brand,
      vehicle_model,
      cranes!inner (
        license_plate
      ),
      operators!inner (
        name
      ),
      service_types!inner (
        name
      ),
      clients!services_client_id_fkey (
        name
      )
    `)
    .eq('client_id', clientId)
    .order('service_date', { ascending: false });

  if (error) {
    logger.error('Error fetching client services for export:', error);
    throw error;
  }

  return data.map((service: any) => ({
    id: service.id,
    folio: service.folio,
    service_date: service.service_date,
    status: service.status,
    origin: service.origin,
    destination: service.destination,
    value: service.value,
    license_plate: service.license_plate,
    vehicle_brand: service.vehicle_brand,
    vehicle_model: service.vehicle_model,
    crane_license_plate: service.cranes.license_plate,
    operator_name: service.operators.name,
    service_type_name: service.service_types.name,
    client_name: service.clients.name,
  }));
};

// Función para obtener el nombre del cliente
const fetchClientName = async (clientId: string): Promise<string> => {
  if (!clientId) return 'Cliente Portal';
  
  const { data, error } = await supabase
    .from('clients')
    .select('name')
    .eq('id', clientId)
    .single();

  if (error) {
    logger.error('Error fetching client name:', error);
    return 'Cliente Portal';
  }
  return data.name;
};

// Modificar el hook para aceptar servicios filtrados y rango de fechas
export const useClientServiceExport = (filteredServices?: any[], dateFrom?: Date, dateTo?: Date) => {
  const { user } = useUser();
  const { toast } = useToast();
  const { settings } = useSettings();

  // Obtener el nombre del cliente
  const { data: clientName = 'Cliente Portal' } = useQuery({
    queryKey: ['clientName', user?.client_id],
    queryFn: () => fetchClientName(user?.client_id || ''),
    enabled: !!user?.client_id,
  });

  const { data: allServices = [], isLoading: isLoadingServices } = useQuery({
    queryKey: ['clientServicesForExport', user?.client_id],
    queryFn: () => fetchClientServicesForExport(user?.client_id || ''),
    enabled: !!user?.client_id,
  });

  // Usar servicios filtrados si se proporcionan, sino usar todos
  const servicesToUse = filteredServices || allServices;

  // Función para transformar servicios
  const transformServices = useCallback((servicesToTransform: ClientService[]) => {
    return servicesToTransform.map(service => ({
      id: service.id,
      folio: service.folio,
      requestDate: service.service_date,
      serviceDate: service.service_date,
      client: {
        id: '',
        name: clientName, // Usar el nombre real del cliente en lugar de service.client_name
        rut: '',
        phone: '',
        email: '',
        address: '',
        department: '',
        isActive: true,
        createdAt: '',
        updatedAt: '',
      },
      vehicleBrand: service.vehicle_brand || '',
      vehicleModel: service.vehicle_model || '',
      licensePlate: service.license_plate || '',
      origin: service.origin,
      destination: service.destination,
      serviceType: {
        id: '',
        name: service.service_type_name,
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
      value: service.value,
      crane: {
        id: '',
        licensePlate: service.crane_license_plate,
        brand: '',
        model: '',
        type: 'medium' as const,
        circulationPermitExpiry: '',
        insuranceExpiry: '',
        technicalReviewExpiry: '',
        isActive: true,
        createdAt: '',
        updatedAt: '',
      },
      operator: {
        id: '',
        name: service.operator_name,
        rut: '',
        phone: '',
        operatorType: 'crane_operator' as const,
        licenseNumber: '',
        examExpiry: '',
        isActive: true,
        createdAt: '',
        updatedAt: '',
      },
      operatorCommission: 0,
      status: service.status as any,
      createdAt: '',
      updatedAt: '',
    }));
  }, [clientName]);

  const exportToPDF = useCallback(async () => {
    if (!servicesToUse || servicesToUse.length === 0) {
      toast({
        title: "Sin servicios",
        description: "No hay servicios para exportar.",
        type: "error",
      });
      return;
    }

    try {
      toast({
        title: "Generando PDF...",
        description: "Por favor espere mientras se genera el reporte.",
        type: "info",
      });

      // Calcular fechas
      const calculatedDateFrom = dateFrom || (servicesToUse.length > 0 ? new Date(Math.min(...servicesToUse.map(s => new Date(s.service_date).getTime()))) : businessClock.now());
      const calculatedDateTo = dateTo || (servicesToUse.length > 0 ? new Date(Math.max(...servicesToUse.map(s => new Date(s.service_date).getTime()))) : businessClock.now());

      const currentDate = businessClock.today();
      const customFileName = `mis-servicios-${currentDate}`;

      // Transformar servicios
      const transformedServices = transformServices(servicesToUse);

      await exportServiceReport({
        services: transformedServices,
        settings: settings,
        appliedFilters: {
          dateRange: {
            from: format(calculatedDateFrom, 'yyyy-MM-dd'),
            to: format(calculatedDateTo, 'yyyy-MM-dd')
          },
          client: clientName // Usar el nombre real del cliente en lugar de user?.name
        },
        format: 'pdf',
        customFileName,
      });

      toast({
        title: "PDF generado",
        description: `Se ha generado el reporte ${customFileName}.pdf correctamente.`,
        type: "success",
      });
    } catch (error) {
      logger.error('Error exporting services to PDF:', error);
      toast({
        title: "Error",
        description: "Ocurrió un error al generar el PDF. Por favor intente nuevamente.",
        type: "error",
      });
    }
  }, [servicesToUse, toast, dateFrom, dateTo, transformServices, settings, clientName]);

  const exportToExcel = useCallback(async () => {
    if (!servicesToUse || servicesToUse.length === 0) {
      toast({
        title: "Sin servicios",
        description: "No hay servicios para exportar.",
        type: "error",
      });
      return;
    }

    try {
      toast({
        title: "Generando Excel...",
        description: "Por favor espere mientras se genera el reporte.",
        type: "info",
      });

      // Calcular fechas
      const calculatedDateFrom = dateFrom || (servicesToUse.length > 0 ? new Date(Math.min(...servicesToUse.map(s => new Date(s.service_date).getTime()))) : businessClock.now());
      const calculatedDateTo = dateTo || (servicesToUse.length > 0 ? new Date(Math.max(...servicesToUse.map(s => new Date(s.service_date).getTime()))) : businessClock.now());

      const currentDate = businessClock.today();
      const customFileName = `mis-servicios-${currentDate}`;

      // Transformar servicios
      const transformedServices = transformServices(servicesToUse);

      await exportServiceReport({
        services: transformedServices,
        settings: settings,
        appliedFilters: {
          dateRange: {
            from: format(calculatedDateFrom, 'yyyy-MM-dd'),
            to: format(calculatedDateTo, 'yyyy-MM-dd')
          },
          client: clientName // Usar el nombre real del cliente en lugar de user?.name
        },
        format: 'excel',
        customFileName,
      });

      toast({
        title: "Excel generado",
        description: `Se ha generado el reporte ${customFileName}.xlsx correctamente.`,
        type: "success",
      });
    } catch (error) {
      logger.error('Error exporting services to Excel:', error);
      toast({
        title: "Error",
        description: "Ocurrió un error al generar el Excel. Por favor intente nuevamente.",
        type: "error",
      });
    }
  }, [servicesToUse, toast, dateFrom, dateTo, transformServices, settings, clientName]);

  return {
    exportToPDF,
    exportToExcel,
    servicesCount: servicesToUse.length,
    isLoadingServices,
  };
};