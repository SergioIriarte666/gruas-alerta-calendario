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
 * Filtro PostgREST que acota `services` a un cliente.
 *
 * La fila cubierta pertenece al cliente principal (`client_id`) y la fila de
 * excedente al tercero pagador (`third_party_client_id`), así que filtrar por
 * cliente en el servidor exige mirar ambas.
 */
export const buildClosureClientFilter = (clientId: string): string =>
  `client_id.eq.${clientId},third_party_client_id.eq.${clientId}`;

/**
 * Criterio único de pertenencia a cliente de una fila de cierre.
 *
 * Espeja `buildClosureClientFilter`: la fila ya viene con el cliente que le
 * corresponde (principal o tercero pagador), y sin cliente seleccionado pasan
 * todas. Lo comparten la lista, el contador y los mensajes de estado para que
 * nunca cuenten cosas distintas.
 */
export const matchesClosureClient = (
  row: { client?: { id?: string } | null },
  clientId?: string,
): boolean => {
  if (!clientId) return true;
  return row.client?.id === clientId;
};

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
