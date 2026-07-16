import { supabase } from '@/integrations/supabase/client';
import type { LowboyContainerSaleAssignment, LowboySaleFormValues, LowboySaleStatus } from '@/types/lowboySales';
import { normalizeRut } from '@/utils/rutFormatter';

export type SaveLowboySaleInput = {
  saleId?: string;
  values: LowboySaleFormValues;
  status: Exclude<LowboySaleStatus, 'cancelada'>;
  executedDate?: string | null;
  containerAssignments?: LowboyContainerSaleAssignment[];
  rcvRecordId?: string;
};

export async function saveLowboySaleWithContainers({
  saleId,
  values,
  status,
  executedDate,
  containerAssignments = [],
  rcvRecordId,
}: SaveLowboySaleInput): Promise<string> {
  const isFlete = values.sale_type === 'flete';
  const { data, error } = await supabase.rpc('save_lowboy_sale_with_containers', {
    p_sale_id: saleId ?? null,
    p_sale_type: values.sale_type,
    p_client_rut: normalizeRut(values.client_rut),
    p_client_name: values.client_name.trim(),
    p_description: values.description.trim(),
    p_origin: isFlete ? values.origin.trim() || null : null,
    p_destination: isFlete ? values.destination.trim() || null : null,
    p_scheduled_date: values.scheduled_date || null,
    p_executed_date: executedDate || null,
    p_net_amount: values.net_amount,
    p_status: status,
    p_notes: values.notes.trim() || null,
    p_container_assignments: containerAssignments,
    p_rcv_record_id: rcvRecordId ?? null,
  });
  if (error) throw error;
  return data;
}
