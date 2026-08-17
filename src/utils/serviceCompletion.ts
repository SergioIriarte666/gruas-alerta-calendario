import { supabase } from '@/integrations/supabase/client';

/**
 * Cierre de servicios: una sola vía.
 *
 * `complete_service(id, folio)` es la única función que cierra un servicio. Las
 * tres funciones legacy que existían para "forzar" el cierre (emergency_close_service,
 * force_close_service_bypass_triggers, close_service_status_only) se eliminaron:
 * ninguna validaba folio ni asignación, dos deshabilitaban triggers y ninguna
 * estampaba end_time.
 *
 * El folio viaja SIEMPRE, admin incluido: es la doble llave que garantiza que se
 * cierra el servicio que la pantalla muestra y no otro. Un UPDATE directo de
 * `services.status` no es sustituto — se salta end_time y la revocación de links
 * de tracking, sesiones de GPS y eventos de parada.
 */
export interface ServiceCloseTarget {
  id: string;
  folio: string;
}

export interface BatchCompleteResult {
  successCount: number;
  errorCount: number;
  /** Mensaje del primer fallo: los RAISE del servidor están escritos para leerse. */
  firstError: string | null;
}

/** Cierra un servicio. Propaga el error del servidor tal cual para mostrarlo. */
export const completeServiceByFolio = async (target: ServiceCloseTarget): Promise<void> => {
  const { error } = await supabase.rpc('complete_service', {
    p_service_id: target.id,
    p_folio_confirmation: target.folio,
  });
  if (error) throw error;
};

/**
 * Cierra varios servicios de uno en uno. Secuencial a propósito: cada cierro
 * dispara triggers (comisiones, tracking, sesiones GPS) y un servicio que falla
 * no debe arrastrar a los demás.
 */
export const completeServicesByFolio = async (
  targets: ServiceCloseTarget[],
): Promise<BatchCompleteResult> => {
  let successCount = 0;
  let errorCount = 0;
  let firstError: string | null = null;

  for (const target of targets) {
    try {
      await completeServiceByFolio(target);
      successCount++;
    } catch (error) {
      errorCount++;
      if (!firstError) {
        firstError = error instanceof Error ? error.message : String(error);
      }
    }
  }

  return { successCount, errorCount, firstError };
};
