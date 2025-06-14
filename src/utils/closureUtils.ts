
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
