import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { normalizeRut } from '@/utils/rutFormatter';
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
  serviceId: string | null;
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
  /** 'table' = inventory_suppliers; 'dte' = resuelto/derivado del RUT emisor del DTE. */
  supplierSource: 'table' | 'dte' | null;
};

/**
 * Resuelve la razón social desde la caché rut_directory SIN llamar a sre-lookup
 * (el modal es de solo lectura y no debe consumir cuota de la API).
 */
async function readRazonSocialFromCache(rut: string): Promise<string | null> {
  const key = normalizeRut(rut);
  if (!key) return null;
  const { data, error } = await supabase
    .from('rut_directory')
    .select('razon_social')
    .eq('rut', key)
    .maybeSingle();
  if (error) logger.warn('No se pudo leer rut_directory', key, error.message);
  return data?.razon_social ?? null;
}

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
  // costs.supplier_id apunta a inventory_suppliers (NO a suppliers). Se usa el hint
  // explícito de relación para evitar embeds ambiguos (mismo patrón que useCosts).
  const { data, error } = await supabase
    .from('costs')
    .select(`
      id, date, description, amount, subcategory, service_folio, service_id, notes, payment_date,
      document_type, document_number, entity, paid_by, dte_tipo, dte_folio, dte_rut_emisor,
      receipt_photo_paths, supplier_id,
      category:cost_categories!costs_category_id_fkey(name),
      cost_center:cost_centers!costs_cost_center_id_fkey(name),
      supplier:inventory_suppliers!costs_supplier_id_fkey(name)
    `)
    .eq('id', costId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { kind: 'deleted' };

  // Preferimos el proveedor de la tabla (inventory_suppliers). Si no hay supplier_id
  // pero sí RUT emisor del DTE, resolvemos la razón social desde la caché rut_directory
  // (o mostramos el RUT), marcándolo como derivado del DTE.
  let supplierName: string | null = data.supplier?.name ?? null;
  let supplierSource: 'table' | 'dte' | null = supplierName ? 'table' : null;
  if (!supplierName && data.dte_rut_emisor) {
    supplierName = (await readRazonSocialFromCache(data.dte_rut_emisor)) ?? data.dte_rut_emisor;
    supplierSource = 'dte';
  }

  return {
    kind: 'cost',
    id: data.id,
    date: data.date,
    description: data.description,
    amount: Number(data.amount) || 0,
    subcategory: data.subcategory,
    serviceFolio: data.service_folio,
    serviceId: data.service_id,
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
    supplierSource,
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
