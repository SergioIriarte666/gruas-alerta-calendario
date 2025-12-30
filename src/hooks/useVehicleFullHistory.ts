import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ServiceStatus } from '@/types';
import { getServiceValueForClosure } from '@/utils/serviceValueCalculations';

export interface VehicleFullHistoryEntry {
  id: string;
  folio: string;
  serviceDate: string;
  requestDate: string;
  status: ServiceStatus;
  value: number;
  origin: string;
  destination: string;
  
  // Tipo de servicio
  serviceType: { name: string };
  
  // Cliente
  client: { 
    name: string; 
    rut: string; 
    department: string;
  };
  
  // Documentos comerciales
  quoteNumber: string | null;
  purchaseOrder: string | null;
  purchaseOrderNumber: string | null;
  
  // Factura (si existe)
  invoice: {
    id: string;
    folio: string;
    numeroFiscal: string | null;
    issueDate: string;
    status: string;
    total: number;
  } | null;
  
  // Datos del vehículo
  vehicleBrand: string;
  vehicleModel: string;
  licensePlate: string;
}

export interface VehicleFullHistorySummary {
  totalServices: number;
  totalValue: number;
  totalInvoiced: number;
  servicesWithQuote: number;
  servicesWithPO: number;
  servicesWithInvoice: number;
  vehicleBrand: string;
  vehicleModel: string;
  licensePlate: string;
  firstServiceDate: string | null;
  lastServiceDate: string | null;
}

const fetchVehicleFullHistory = async (licensePlate: string): Promise<VehicleFullHistoryEntry[]> => {
  if (!licensePlate) return [];

  const normalizedPlate = licensePlate.toUpperCase().replace(/[^A-Z0-9]/g, '');
  console.log('Fetching full vehicle history for:', normalizedPlate);

  // Obtener servicios con datos completos
  const { data: servicesData, error: servicesError } = await supabase
    .from('services')
    .select(`
      id,
      folio,
      service_date,
      request_date,
      status,
      value,
      origin,
      destination,
      quote_number,
      purchase_order,
      purchase_order_number,
      vehicle_brand,
      vehicle_model,
      license_plate,
      custody_total_amount,
      has_excess,
      client_covered_amount,
      service_types(name),
      clients!services_client_id_fkey(name, rut, department)
    `)
    .ilike('license_plate', `%${normalizedPlate}%`)
    .order('service_date', { ascending: false });

  if (servicesError) {
    console.error('Error fetching vehicle services:', servicesError);
    throw new Error('Could not fetch vehicle history');
  }

  if (!servicesData || servicesData.length === 0) {
    return [];
  }

  // Obtener IDs de servicios para buscar facturas
  const serviceIds = servicesData.map(s => s.id);

  // Buscar facturas vinculadas a los servicios
  const { data: invoiceServicesData, error: invoiceError } = await supabase
    .from('invoice_services')
    .select(`
      service_id,
      invoices(
        id,
        folio,
        numero_fiscal,
        issue_date,
        status,
        total
      )
    `)
    .in('service_id', serviceIds);

  if (invoiceError) {
    console.error('Error fetching invoice data:', invoiceError);
  }

  // Crear mapa de facturas por service_id
  const invoiceMap = new Map<string, any>();
  if (invoiceServicesData) {
    invoiceServicesData.forEach((is: any) => {
      if (is.invoices) {
        invoiceMap.set(is.service_id, is.invoices);
      }
    });
  }

  // Mapear resultados
  return servicesData.map((item: any) => {
    const invoice = invoiceMap.get(item.id);
    const calculatedValue = getServiceValueForClosure({
      value: item.value,
      custody_total_amount: item.custody_total_amount,
      has_excess: item.has_excess,
      client_covered_amount: item.client_covered_amount
    });

    return {
      id: item.id,
      folio: item.folio,
      serviceDate: item.service_date,
      requestDate: item.request_date,
      status: item.status,
      value: calculatedValue,
      origin: item.origin || '',
      destination: item.destination || '',
      serviceType: item.service_types || { name: 'Desconocido' },
      client: item.clients || { name: 'Desconocido', rut: '', department: '' },
      quoteNumber: item.quote_number,
      purchaseOrder: item.purchase_order,
      purchaseOrderNumber: item.purchase_order_number,
      vehicleBrand: item.vehicle_brand || '',
      vehicleModel: item.vehicle_model || '',
      licensePlate: item.license_plate || '',
      invoice: invoice ? {
        id: invoice.id,
        folio: invoice.folio,
        numeroFiscal: invoice.numero_fiscal,
        issueDate: invoice.issue_date,
        status: invoice.status,
        total: Number(invoice.total || 0)
      } : null
    };
  });
};

export const useVehicleFullHistory = (licensePlate: string) => {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['vehicleFullHistory', licensePlate],
    queryFn: () => fetchVehicleFullHistory(licensePlate),
    enabled: !!licensePlate && licensePlate.length >= 4,
  });

  // Calcular resumen
  const summary: VehicleFullHistorySummary | null = data && data.length > 0 ? {
    totalServices: data.length,
    totalValue: data.reduce((sum, entry) => sum + entry.value, 0),
    totalInvoiced: data.reduce((sum, entry) => sum + (entry.invoice?.total || 0), 0),
    servicesWithQuote: data.filter(e => e.quoteNumber).length,
    servicesWithPO: data.filter(e => e.purchaseOrder || e.purchaseOrderNumber).length,
    servicesWithInvoice: data.filter(e => e.invoice).length,
    vehicleBrand: data[0]?.vehicleBrand || '',
    vehicleModel: data[0]?.vehicleModel || '',
    licensePlate: data[0]?.licensePlate || licensePlate,
    firstServiceDate: data.length > 0 ? data[data.length - 1].serviceDate : null,
    lastServiceDate: data.length > 0 ? data[0].serviceDate : null
  } : null;

  return { 
    history: data || [], 
    summary,
    isLoading, 
    error,
    refetch 
  };
};
