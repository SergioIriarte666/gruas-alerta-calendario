
import { ServiceClosure } from '@/types';

export const formatClosureData = (data: any): ServiceClosure => ({
  id: data.id,
  folio: data.folio,
  serviceIds: data.closure_services?.map((cs: any) => cs.service_id) || [],
  dateRange: {
    from: data.date_from,
    to: data.date_to
  },
  clientId: data.client_id || undefined,
  total: Number(data.total),
  status: data.status as ServiceClosure['status'],
  createdAt: data.created_at,
  updatedAt: data.updated_at
});

export const generateClosureFolio = (count: number): string => {
  return `CIE-${String(count + 1).padStart(3, '0')}`;
};
