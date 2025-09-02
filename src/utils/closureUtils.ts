
import { ServiceClosure } from '@/types';

export const formatClosureData = (data: any): ServiceClosure => {
  console.log('Formatting closure data:', data);
  
  try {
    const formatted: ServiceClosure = {
      id: data.id,
      folio: data.folio || 'N/A',
      serviceIds: data.closure_services?.map((cs: any) => cs.service_id) || [],
      dateRange: {
        from: data.date_from,
        to: data.date_to
      },
      clientId: data.client_id || undefined,
      total: Number(data.total) || 0,
      status: data.status as ServiceClosure['status'] || 'open',
      purchaseOrder: data.purchase_order || undefined,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
    
    console.log('Formatted closure:', formatted);
    return formatted;
  } catch (error) {
    console.error('Error in formatClosureData:', error, data);
    throw error;
  }
};

export const generateClosureFolio = (count: number): string => {
  return `CIE-${String(count + 1).padStart(3, '0')}`;
};

export const detectPurchaseOrders = (services: any[]): string => {
  if (!services || services.length === 0) return '';
  
  // Extract all purchase orders from selected services
  const purchaseOrders = services
    .map(service => service.purchaseOrder || service.purchaseOrderNumber)
    .filter(Boolean)
    .filter((po, index, arr) => arr.indexOf(po) === index); // Remove duplicates
  
  if (purchaseOrders.length === 0) return '';
  if (purchaseOrders.length === 1) return purchaseOrders[0];
  
  // Multiple purchase orders - concatenate them
  return purchaseOrders.join(', ');
};

export const getPurchaseOrderSummary = (services: any[]): string => {
  if (!services || services.length === 0) return '';
  
  const withPO = services.filter(s => s.purchaseOrder || s.purchaseOrderNumber);
  const withoutPO = services.filter(s => !s.purchaseOrder && !s.purchaseOrderNumber);
  
  const parts = [];
  if (withPO.length > 0) {
    parts.push(`${withPO.length} servicio(s) con OC`);
  }
  if (withoutPO.length > 0) {
    parts.push(`${withoutPO.length} servicio(s) sin OC`);
  }
  
  return parts.join(' • ');
};
