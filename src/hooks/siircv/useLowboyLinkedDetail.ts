import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import type { SiiRcvRecordRow } from '@/types/siiRcv';

const logger = createLogger('LowboyLinkedDetail');

export type LinkedCostDetail = {
  kind: 'cost';
  id: string;
  date: string | null;
  description: string | null;
  amount: number;
  subcategory: string | null;
  serviceFolio: string | null;
  notes: string | null;
  paymentDate: string | null;
  documentType: string | null;
  documentNumber: string | null;
  entity: string | null;
  paidBy: string | null;
  dteTipo: number | null;
  dteFolio: number | null;
  dteRutEmisor: string | null;
  receiptPhotoPaths: string[];
  categoryName: string | null;
  costCenterName: string | null;
  supplierName: string | null;
};

export type LinkedServiceDetail = {
  kind: 'service';
  id: string;
  folio: string | null;
  serviceDate: string | null;
  value: number;
  status: string | null;
  origin: string | null;
  destination: string | null;
  clientName: string | null;
};

export type LinkedDetail = LinkedCostDetail | LinkedServiceDetail | { kind: 'deleted' };

async function fetchCostDetail(costId: string): Promise<LinkedDetail> {
  const { data, error } = await supabase
    .from('costs')
    .select(`
      id, date, description, amount, subcategory, service_folio, notes, payment_date,
      document_type, document_number, entity, paid_by, dte_tipo, dte_folio, dte_rut_emisor,
      receipt_photo_paths, supplier_id,
      category:cost_categories!costs_category_id_fkey(name),
      cost_center:cost_centers!costs_cost_center_id_fkey(name)
    `)
    .eq('id', costId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { kind: 'deleted' };

  // suppliers no tiene FK declarada desde costs: se resuelve el nombre por separado.
  let supplierName: string | null = null;
  if (data.supplier_id) {
    const { data: supplier } = await supabase
      .from('suppliers')
      .select('name')
      .eq('id', data.supplier_id)
      .maybeSingle();
    supplierName = supplier?.name ?? null;
  }

  return {
    kind: 'cost',
    id: data.id,
    date: data.date,
    description: data.description,
    amount: Number(data.amount) || 0,
    subcategory: data.subcategory,
    serviceFolio: data.service_folio,
    notes: data.notes,
    paymentDate: data.payment_date,
    documentType: data.document_type,
    documentNumber: data.document_number,
    entity: data.entity,
    paidBy: data.paid_by,
    dteTipo: data.dte_tipo,
    dteFolio: data.dte_folio,
    dteRutEmisor: data.dte_rut_emisor,
    receiptPhotoPaths: (data.receipt_photo_paths ?? []).filter(Boolean),
    categoryName: data.category?.name ?? null,
    costCenterName: data.cost_center?.name ?? null,
    supplierName,
  };
}

async function fetchServiceDetail(serviceId: string): Promise<LinkedDetail> {
  const { data, error } = await supabase
    .from('services')
    .select('id, folio, service_date, value, status, origin, destination, client:clients!services_client_id_fkey(name)')
    .eq('id', serviceId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { kind: 'deleted' };

  return {
    kind: 'service',
    id: data.id,
    folio: data.folio,
    serviceDate: data.service_date,
    value: Number(data.value) || 0,
    status: data.status,
    origin: data.origin,
    destination: data.destination,
    clientName: data.client?.name ?? null,
  };
}

/** Carga perezosa (solo con el modal abierto) del detalle del costo/servicio vinculado. */
export function useLowboyLinkedDetail(record: SiiRcvRecordRow | null, open: boolean) {
  const linkedCostId = record?.linked_cost_id ?? null;
  const linkedServiceId = record?.linked_service_id ?? null;

  return useQuery({
    queryKey: ['lowboy-linked-detail', record?.id, linkedCostId, linkedServiceId],
    enabled: open && !!record && (!!linkedCostId || !!linkedServiceId),
    staleTime: 60 * 1000,
    queryFn: async (): Promise<LinkedDetail> => {
      try {
        if (record?.book_type === 'compra' && linkedCostId) return await fetchCostDetail(linkedCostId);
        if (record?.book_type === 'venta' && linkedServiceId) return await fetchServiceDetail(linkedServiceId);
        return { kind: 'deleted' };
      } catch (e) {
        logger.error('Error cargando detalle del vínculo', e);
        throw e;
      }
    },
  });
}
