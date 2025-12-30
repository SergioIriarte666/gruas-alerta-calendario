import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getServiceValueForClosure } from '@/utils/serviceValueCalculations';

export interface VehicleHistoryRecord {
  id: string;
  type: 'service' | 'invoice';
  folio: string;
  date: string;
  clientName: string;
  clientRut: string;
  status: string;
  value: number;
  origin?: string;
  destination?: string;
  serviceTypeName?: string;
  quoteNumber?: string;
  purchaseOrder?: string;
  invoiceFolio?: string;
  invoiceNumeroFiscal?: string;
  operatorName?: string;
  cranePlate?: string;
  // Para agrupar servicio con su factura
  relatedInvoice?: {
    id: string;
    folio: string;
    date: string;
    status: string;
    value: number;
    numeroFiscal?: string;
  };
}

export interface VehicleFullHistoryData {
  licensePlate: string;
  vehicleBrand?: string;
  vehicleModel?: string;
  // Servicios agrupados (cada servicio puede tener su factura relacionada)
  services: VehicleHistoryRecord[];
  summary: {
    totalServices: number;
    totalValue: number;
    totalQuotes: number;
    totalPurchaseOrders: number;
    totalInvoices: number;
    completedServices: number;
    cancelledServices: number;
  };
}

// Normaliza la patente para búsqueda flexible (sin guiones ni espacios)
const normalizeLicensePlate = (plate: string): string => {
  return plate.replace(/[-\s]/g, '').toUpperCase();
};

const fetchVehicleFullHistory = async (licensePlate: string): Promise<VehicleFullHistoryData | null> => {
  if (!licensePlate || licensePlate.trim().length < 4) return null;

  const normalizedPlate = normalizeLicensePlate(licensePlate);
  console.log('📋 Fetching full vehicle history for:', licensePlate, '(normalized:', normalizedPlate, ')');

  // Buscar servicios con patente coincidente (flexibilidad con guiones)
  const { data: servicesData, error: servicesError } = await supabase
    .from('services')
    .select(`
      id,
      folio,
      service_date,
      status,
      value,
      origin,
      destination,
      license_plate,
      vehicle_brand,
      vehicle_model,
      quote_number,
      purchase_order,
      custody_total_amount,
      has_excess,
      client_covered_amount,
      excess_amount,
      observations,
      service_types(id, name),
      client:clients!services_client_id_fkey(id, name, rut),
      third_party_client:clients!services_third_party_client_id_fkey(id, name, rut),
      operators(id, name),
      cranes(id, license_plate, brand, model)
    `)
    .order('service_date', { ascending: false });

  if (servicesError) {
    console.error('Error fetching services:', servicesError);
    throw servicesError;
  }

  // Filtrar servicios que coincidan con la patente (tolerante a guiones)
  const matchingServices = (servicesData || []).filter((s: any) => {
    const servicePlate = normalizeLicensePlate(s.license_plate || '');
    return servicePlate === normalizedPlate;
  });

  console.log(`📋 Total services in DB: ${servicesData?.length || 0}`);
  console.log(`📋 Found ${matchingServices.length} services for plate ${licensePlate}`);
  console.log('📋 Services by status:', matchingServices.reduce((acc: any, s: any) => {
    acc[s.status] = (acc[s.status] || 0) + 1;
    return acc;
  }, {}));

  if (matchingServices.length === 0) {
    return {
      licensePlate,
      services: [],
      summary: {
        totalServices: 0,
        totalValue: 0,
        totalQuotes: 0,
        totalPurchaseOrders: 0,
        totalInvoices: 0,
        completedServices: 0,
        cancelledServices: 0,
      }
    };
  }

  // Obtener IDs de servicios para buscar facturas relacionadas
  const serviceIds = matchingServices.map((s: any) => s.id);

  // Buscar facturas relacionadas a estos servicios
  const { data: invoiceServicesData } = await supabase
    .from('invoice_services')
    .select(`
      service_id,
      invoice:invoices(
        id,
        folio,
        issue_date,
        total,
        status,
        numero_fiscal,
        client:clients(name, rut)
      )
    `)
    .in('service_id', serviceIds);

  // Crear mapa de servicios a facturas
  const serviceToInvoice: Record<string, any> = {};
  (invoiceServicesData || []).forEach((rel: any) => {
    if (rel.invoice) {
      serviceToInvoice[rel.service_id] = rel.invoice;
    }
  });

  // Construir registros del historial - AGRUPADOS POR SERVICIO
  const services: VehicleHistoryRecord[] = [];
  let vehicleBrand = '';
  let vehicleModel = '';
  let totalQuotes = 0;
  let totalPurchaseOrders = 0;
  let totalInvoices = 0;
  let completedServices = 0;
  let cancelledServices = 0;

  matchingServices.forEach((service: any) => {
    // Capturar marca/modelo del primer servicio que lo tenga
    if (!vehicleBrand && service.vehicle_brand) vehicleBrand = service.vehicle_brand;
    if (!vehicleModel && service.vehicle_model) vehicleModel = service.vehicle_model;

    const client = service.client || service.third_party_client;
    const serviceValue = getServiceValueForClosure(service);

    // Contar estados
    if (service.status === 'completed' || service.status === 'invoiced') completedServices++;
    if (service.status === 'cancelled') cancelledServices++;
    if (service.quote_number) totalQuotes++;
    if (service.purchase_order) totalPurchaseOrders++;

    // Obtener factura relacionada si existe
    const invoice = serviceToInvoice[service.id];
    let relatedInvoice = undefined;
    
    if (invoice) {
      totalInvoices++;
      relatedInvoice = {
        id: invoice.id,
        folio: invoice.folio,
        date: invoice.issue_date,
        status: invoice.status,
        value: Number(invoice.total) || 0,
        numeroFiscal: invoice.numero_fiscal
      };
    }

    // Agregar servicio con su factura relacionada
    services.push({
      id: service.id,
      type: 'service',
      folio: service.folio,
      date: service.service_date,
      clientName: client?.name || 'N/A',
      clientRut: client?.rut || 'N/A',
      status: service.status,
      value: serviceValue,
      origin: service.origin,
      destination: service.destination,
      serviceTypeName: service.service_types?.name,
      quoteNumber: service.quote_number,
      purchaseOrder: service.purchase_order,
      operatorName: service.operators?.name,
      cranePlate: service.cranes?.license_plate,
      relatedInvoice
    });
  });

  // Ordenar servicios por fecha descendente
  services.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalValue = services.reduce((sum, r) => sum + r.value, 0);

  return {
    licensePlate,
    vehicleBrand,
    vehicleModel,
    services,
    summary: {
      totalServices: matchingServices.length,
      totalValue,
      totalQuotes,
      totalPurchaseOrders,
      totalInvoices,
      completedServices,
      cancelledServices,
    }
  };
};

export const useVehicleFullHistory = (licensePlate: string) => {
  return useQuery({
    queryKey: ['vehicleFullHistory', licensePlate],
    queryFn: () => fetchVehicleFullHistory(licensePlate),
    enabled: !!licensePlate && licensePlate.trim().length >= 4,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
};
