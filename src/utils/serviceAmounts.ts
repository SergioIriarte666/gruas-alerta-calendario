/**
 * Fuente de verdad unica para los montos de un servicio.
 *
 * Espeja la regla que ya aplica la funcion SQL create_invoice_transaction:
 *   monto_cliente_principal = CASE WHEN has_excess
 *                                  THEN COALESCE(client_covered_amount, value)
 *                                  ELSE value END
 *
 * La consumen el render (Reportes, detalle del servicio) y los exports
 * (Excel y PDF). No reimplementar el calculo en cada consumidor.
 */
import { getCompleteServiceValue } from './serviceValueCalculations';
import { createLogger } from '@/lib/logger';

const logger = createLogger('ServiceAmounts');

/** Tolera objeto crudo de Supabase (snake_case) y objeto mapeado del front (camelCase). */
export interface ServiceAmountSource {
  value?: number | null;
  has_excess?: boolean | null;             hasExcess?: boolean | null;
  client_covered_amount?: number | null;   clientCoveredAmount?: number | null;
  excess_amount?: number | null;           excessAmount?: number | null;
  third_party_client_id?: string | null;   thirdPartyClientId?: string | null;
  [key: string]: unknown;
}

const num = (v: unknown): number => Number(v ?? 0);
const hasExcessOf = (s: ServiceAmountSource) => Boolean(s.has_excess ?? s.hasExcess);
const coveredRaw = (s: ServiceAmountSource) => s.client_covered_amount ?? s.clientCoveredAmount;
const excessRaw = (s: ServiceAmountSource) => s.excess_amount ?? s.excessAmount;

/**
 * Valor total del servicio (aseguradora + excedente).
 *
 * Delega en getCompleteServiceValue en vez de leer `value` crudo porque las
 * custodias y los arriendos de equipos guardan el monto en custody_total_amount
 * con value = 0; leer `value` los reportaria en cero.
 */
export const getTotalAmount = (s: ServiceAmountSource): number => {
  if (!s) return 0;
  return getCompleteServiceValue(s);
};

/** Monto a cobrar al cliente principal (aseguradora). Espeja create_invoice_transaction. */
export const getCoveredAmount = (s: ServiceAmountSource): number => {
  if (!s) return 0;
  const total = getTotalAmount(s);
  if (!hasExcessOf(s)) return total;

  const covered = coveredRaw(s);
  if (covered === null || covered === undefined) {
    logger.warn('Servicio con excedente sin monto cubierto, se usa el total', { total });
    return total;
  }
  return Math.round(num(covered));
};

/** Excedente que paga el tercero. 0 si no aplica. */
export const getExcessAmount = (s: ServiceAmountSource): number => {
  if (!s || !hasExcessOf(s)) return 0;

  const excess = excessRaw(s);
  if (excess !== null && excess !== undefined) return Math.round(num(excess));

  return Math.round(getTotalAmount(s) - num(coveredRaw(s)));
};
