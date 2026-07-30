/**
 * Traducción de los errores de la base al escribir costos de un servicio.
 *
 * La administrativa no tiene por qué leer el texto crudo de Postgres. El caso
 * frecuente es el índice único idx_costs_unique_service_entry sobre
 * (description, amount, date, service_id): dos gastos idénticos el mismo día en
 * el mismo servicio son casi siempre un doble clic, no dos gastos reales.
 */

export const COSTS_UNIQUE_SERVICE_ENTRY_INDEX = 'idx_costs_unique_service_entry';

const UNIQUE_VIOLATION = '23505';

const readString = (source: Record<string, unknown>, key: string): string =>
  typeof source[key] === 'string' ? (source[key] as string) : '';

/**
 * ¿Este error es la colisión del índice de costo duplicado?
 *
 * Se decide por el código SQL y por el NOMBRE del índice, nunca por el texto en
 * prosa del mensaje: ese texto cambia con la versión y el locale de Postgres.
 */
export const isDuplicateServiceCostError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;

  const err = error as Record<string, unknown>;
  if (readString(err, 'code') !== UNIQUE_VIOLATION) return false;

  // PostgREST no expone el constraint en un campo propio; el nombre viaja dentro
  // de message/details. Se busca el identificador exacto, no una frase.
  const haystack = `${readString(err, 'message')} ${readString(err, 'details')}`;
  return haystack.includes(COSTS_UNIQUE_SERVICE_ENTRY_INDEX);
};

export const DUPLICATE_SERVICE_COST_MESSAGE =
  'Ya existe un costo con esa misma descripción, monto y fecha en este servicio.';

/**
 * Mensaje para mostrar al usuario. Devuelve null si el error no es de costos
 * duplicados, para que el llamador use su propio texto.
 */
export const describeServiceCostError = (error: unknown): string | null =>
  isDuplicateServiceCostError(error) ? DUPLICATE_SERVICE_COST_MESSAGE : null;
