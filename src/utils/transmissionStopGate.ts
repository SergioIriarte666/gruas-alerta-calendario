/**
 * Fricción exigida para cortar la transmisión a mano.
 *
 * La regla operativa es una sola: si hay un cliente mirando el link, el corte
 * tiene que ser deliberado y atribuible (PIN). Sin nadie mirando basta una
 * doble confirmación, y no se agrega fricción donde no aporta.
 *
 * Vive aquí, como función pura, porque la noche del 26/07 el gate falló sin que
 * nada lo detectara: el operador cortó el servicio 3262047-1 con el link vigente
 * y accedido (11 aperturas del cliente) y el sistema pasó directo a la doble
 * confirmación. La causa no estuvo en esta decisión sino en el DATO que la
 * alimentaba —`hasActiveLink` había quedado en falso desde el arranque y nunca
 * se releyó, porque el share de las 14:13 falló DESPUÉS de crear el token y se
 * saltó la relectura—. Por eso quien llama debe releer el link contra la BD en
 * el momento del corte, y no confiar en un valor cacheado.
 */
export type TransmissionStopGate = 'pin' | 'confirm';

export interface TransmissionStopGateInput {
  /** ¿Hay un link de seguimiento vigente (no revocado, no expirado)? */
  hasActiveLink: boolean;
  /** ¿El operador tiene PIN configurado en Flota → Operadores? */
  hasPin: boolean;
}

/**
 * Con link vigente y PIN configurado, PIN. En cualquier otro caso, doble
 * confirmación.
 *
 * El fallback sin PIN es intencional, no una omisión: exigir lo que no existe
 * dejaría al operador atrapado sin poder cortar en terreno.
 */
export const resolveTransmissionStopGate = (
  { hasActiveLink, hasPin }: TransmissionStopGateInput,
): TransmissionStopGate => (hasActiveLink && hasPin ? 'pin' : 'confirm');
