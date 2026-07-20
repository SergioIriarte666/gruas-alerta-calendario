import { supabase } from '@/integrations/supabase/client';
import type { LowboyContainerSaleAssignment, LowboySaleFormValues, LowboySaleStatus } from '@/types/lowboySales';
import { computeFleteNeto } from '@/utils/lowboyFleteNeto';
import { normalizeRut } from '@/utils/rutFormatter';

/** Vehículo listo para persistir (patente normalizada a mayúsculas, campos vacíos → null). */
export type LowboySaleVehiclePayload = {
  plate: string | null;
  make: string | null;
  model: string | null;
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
      service_value: vehicle.service_value.trim(),
    }))
    // Fila válida si aporta al menos un campo (marca/modelo/patente/valor).
    .filter((vehicle) => vehicle.plate || vehicle.make || vehicle.model || vehicle.service_value);
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
  const vehiclesPayload = buildVehiclesPayload(values);
  // Con desglose (algún valor de línea O un ajuste), el neto persistido SALE de la
  // fuente única de verdad (misma suma que la UI y que el guard del RPC), nunca de un
  // `net_amount` que pudiera haber quedado obsoleto. Sin desglose, se respeta el neto
  // manual. El ajuste solo aplica a fletes.
  const breakdown = computeFleteNeto(vehiclesPayload, isFlete ? values.adjustment : '');
  const netAmount = isFlete && breakdown.hasBreakdown ? breakdown.sum : values.net_amount;
  const fleteAdjustment = isFlete && breakdown.adjustment !== 0 ? breakdown.adjustment : null;
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
    p_net_amount: netAmount,
    p_status: status,
    p_notes: values.notes.trim() || null,
    p_container_assignments: containerAssignments,
    p_rcv_record_id: rcvRecordId ?? null,
    p_vehicles: vehiclesPayload,
    p_flete_adjustment: fleteAdjustment,
  });
  if (error) throw error;
  return data;
}
