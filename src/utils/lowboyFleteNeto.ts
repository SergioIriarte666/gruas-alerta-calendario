/**
 * Agregación del neto de un flete LowBoy a partir de las líneas de "Valor Servicio"
 * y del ajuste comercial único de la venta.
 *
 * FUENTE ÚNICA DE VERDAD, compartida por el formulario (UI), el schema zod y el
 * manager de persistencia. Antes esta suma estaba duplicada en varios lugares, lo
 * que permitía que divergieran (p.ej. excluir negativos en un sitio y no en otro).
 *
 * Regla de negocio: el neto = SUMA de los `service_value` de los vehículos + el
 * `adjustment` de la venta. El ajuste (y cualquier valor de línea) puede ser negativo
 * (descuento) o positivo (recargo). El único límite —neto resultante >= 0— se valida
 * sobre el TOTAL, nunca sobre cada línea o sobre el ajuste por separado.
 */
export type FleteNetoRow = { service_value?: string | number | null };

/** Valor de ajuste tal como llega del formulario (texto), o ya normalizado (número). */
export type FleteAdjustmentInput = string | number | null | undefined;

/**
 * ¿El texto es un entero (con signo opcional)? Un valor vacío, nulo o parcial
 * (p.ej. "-" mientras se escribe) NO cuenta, evitando así sumar `NaN`.
 */
const isSignedInteger = (value: FleteAdjustmentInput): boolean =>
  /^-?\d+$/.test(String(value ?? '').trim());

/** ¿La línea de vehículo aporta un valor numérico entero? Acepta signo negativo. */
export const hasFleteServiceValue = (value: FleteNetoRow['service_value']): boolean =>
  isSignedInteger(value);

/** Ajuste como número entero; vacío / no numérico → 0 (= sin ajuste). */
export const parseFleteAdjustment = (adjustment: FleteAdjustmentInput): number =>
  isSignedInteger(adjustment) ? Number(String(adjustment).trim()) : 0;

export interface FleteNetoBreakdown {
  /** Nº de vehículos con valor cargado (incluye valores negativos). */
  vehicleCount: number;
  /** Suma de los valores de servicio de los vehículos (sin el ajuste). */
  vehiclesSum: number;
  /** Ajuste comercial normalizado (0 si vacío/ausente). */
  adjustment: number;
  /** Hay un ajuste distinto de 0. */
  hasAdjustment: boolean;
  /** Hay desglose → el neto se calcula y se bloquea (algún valor de línea O un ajuste). */
  hasBreakdown: boolean;
  /** Neto resultante = vehiclesSum + adjustment (puede ser < 0; el submit se bloquea). */
  sum: number;
}

/**
 * Calcula el desglose del neto de un flete. Funciona tanto con las filas del
 * formulario (`service_value` como texto) como con el payload ya normalizado.
 */
export const computeFleteNeto = (
  rows: readonly FleteNetoRow[] | null | undefined,
  adjustment?: FleteAdjustmentInput,
): FleteNetoBreakdown => {
  const valued = (rows ?? []).filter((row) => hasFleteServiceValue(row?.service_value));
  const vehiclesSum = valued.reduce((total, row) => total + Number(String(row.service_value).trim()), 0);
  const adj = parseFleteAdjustment(adjustment);
  return {
    vehicleCount: valued.length,
    vehiclesSum,
    adjustment: adj,
    hasAdjustment: adj !== 0,
    hasBreakdown: valued.length > 0 || adj !== 0,
    sum: vehiclesSum + adj,
  };
};
