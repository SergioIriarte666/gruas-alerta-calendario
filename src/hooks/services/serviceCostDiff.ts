/**
 * Plan de escritura de los costos del wizard de servicios.
 *
 * El guardado del servicio NO borra costos. Antes lo hacía: borraba todos los
 * del servicio y reinsertaba lo que trajera el estado del formulario, así que un
 * costo cargado desde Finanzas —o simplemente uno que la sección aún no había
 * hidratado— desaparecía sin dejar rastro ni aviso.
 *
 * La regla es: se actualiza lo que ya existe, se inserta lo nuevo, y lo que el
 * formulario no menciona SE QUEDA COMO ESTÁ. Quitar un costo es un acto
 * explícito y confirmado del usuario, y viaja por su propio camino
 * (delete_cost_with_context), no por el guardado del servicio.
 */

export interface PlannableCost {
  id?: unknown;
  description?: string | null;
  amount?: number | null;
}

export interface ServiceCostPlan<T extends PlannableCost> {
  /** Filas que ya existen en la base y hay que actualizar por id. */
  toUpdate: T[];
  /** Filas que aún no existen: alta. Incluye ids temporales del formulario. */
  toInsert: T[];
  /** Filas descartadas por incompletas (sin descripción o sin monto). */
  skipped: T[];
}

const isComplete = (cost: PlannableCost) =>
  !!cost.description && String(cost.description).trim() !== '' && Number(cost.amount) > 0;

export const planServiceCostChanges = <T extends PlannableCost>(
  formCosts: T[],
  persistedIds: Iterable<string>
): ServiceCostPlan<T> => {
  const persisted = persistedIds instanceof Set ? persistedIds : new Set(persistedIds);

  const plan: ServiceCostPlan<T> = { toUpdate: [], toInsert: [], skipped: [] };

  for (const cost of formCosts) {
    if (!isComplete(cost)) {
      plan.skipped.push(cost);
      continue;
    }

    // Solo cuenta como existente si su id sigue vivo en la base: un id temporal
    // (temp-…) o uno ya borrado desde otra pestaña entra como alta, no como un
    // UPDATE que no encontraría fila.
    if (typeof cost.id === 'string' && persisted.has(cost.id)) {
      plan.toUpdate.push(cost);
    } else {
      plan.toInsert.push(cost);
    }
  }

  return plan;
};
