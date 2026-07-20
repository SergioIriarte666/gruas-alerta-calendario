import { supabase } from '@/integrations/supabase/client';
import type { LowboyContainerSaleAssignment, LowboySaleFormValues, LowboySaleStatus } from '@/types/lowboySales';
import { normalizeRut } from '@/utils/rutFormatter';

/** Vehículo listo para persistir (patente normalizada a mayúsculas, campos vacíos → null). */
export type LowboySaleVehiclePayload = {
  plate: string | null;
  make: string | null;
  model: string | null;
  notes: string | null;
  /** Valor del servicio de la línea en CLP como texto ('' = sin valor); el RPC lo castea a bigint. */
  service_value: string;
};

export type SaveLowboySaleInput = {
  saleId?: string;
  values: LowboySaleFormValues;
  status: Exclude<LowboySaleStatus, 'cancelada'>;
  executedDate?: string | null;
  containerAssignments?: LowboyContainerSaleAssignment[];
  rcvRecordId?: string;
};

/**
 * Depura la lista de vehículos del formulario: descarta filas totalmente vacías,
 * recorta espacios y normaliza la patente a mayúsculas. Solo aplica a fletes.
 */
function buildVehiclesPayload(values: LowboySaleFormValues): LowboySaleVehiclePayload[] {
  if (values.sale_type !== 'flete') return [];
  return (values.vehicles ?? [])
    .map((vehicle) => ({
      plate: vehicle.plate.trim().toUpperCase() || null,
      make: vehicle.make.trim() || null,
      model: vehicle.model.trim() || null,
      notes: vehicle.notes.trim() || null,
      service_value: vehicle.service_value.trim(),
    }))
    // Fila válida si aporta al menos un campo (incluye "solo notas" o "solo valor").
    .filter((vehicle) => vehicle.plate || vehicle.make || vehicle.model || vehicle.notes || vehicle.service_value);
}

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
    p_vehicles: buildVehiclesPayload(values),
  });
  if (error) throw error;
  return data;
}
