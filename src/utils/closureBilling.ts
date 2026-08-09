export type ClosureValueType = 'covered' | 'excess';

export const EXCESS_ROW_SUFFIX = '::excess';

// Los servicios facturados deben seguir siendo candidatos de consulta porque un
// servicio con excedente puede tener solo una de sus dos partes facturada.
export const CLOSURE_CANDIDATE_STATUSES = [
  'completed',
  'with_purchase_order',
  'failed',
  'invoiced',
  'partially_invoiced',
] as const;

interface ClosureAvailabilityInput {
  serviceId: string;
  status: string;
  hasExcess: boolean;
  thirdPartyClientId: string | null;
  excessAmount: number;
  valueType: ClosureValueType;
  usedKeys: ReadonlySet<string>;
}

export const getClosureValueKey = (
  serviceId: string,
  valueType: ClosureValueType,
): string => `${serviceId}:${valueType}`;

/**
 * Decide si una parte facturable puede aparecer en un nuevo cierre.
 *
 * Un servicio ya facturado solo vuelve a mostrarse cuando:
 * - realmente admite separación entre cobertura y excedente; y
 * - existe evidencia en closure_services de cuál de las dos partes ya se usó.
 *
 * Esto deja disponible la contraparte pendiente sin reabrir servicios comunes
 * ni registros históricos cuyo alcance facturado no se puede determinar.
 */
export const isClosureValueAvailable = ({
  serviceId,
  status,
  hasExcess,
  thirdPartyClientId,
  excessAmount,
  valueType,
  usedKeys,
}: ClosureAvailabilityInput): boolean => {
  if (usedKeys.has(getClosureValueKey(serviceId, valueType))) {
    return false;
  }

  const isAlreadyInvoiced = status === 'invoiced' || status === 'partially_invoiced';
  if (!isAlreadyInvoiced) {
    return true;
  }

  const canSplit = hasExcess && Boolean(thirdPartyClientId) && excessAmount > 0;
  if (!canSplit) {
    return false;
  }

  return (
    usedKeys.has(getClosureValueKey(serviceId, 'covered')) ||
    usedKeys.has(getClosureValueKey(serviceId, 'excess'))
  );
};
