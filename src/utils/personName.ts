/**
 * Normaliza el espaciado de un nombre escrito a mano en terreno.
 * "Rodrigo  Del Saz " → "Rodrigo Del Saz".
 *
 * Estos nombres terminan impresos y firmados en el acta de inspección: un
 * dedazo con doble espacio queda para siempre en el documento que ve el
 * cliente y el asegurador. No cambia mayúsculas ni acentos — solo espacios.
 */
export const normalizePersonName = (value: string | null | undefined): string => (
  (value ?? '').trim().replace(/\s+/g, ' ')
);

/** Igual que normalizePersonName, pero devuelve null cuando queda vacío (columnas nullable). */
export const normalizePersonNameOrNull = (value: string | null | undefined): string | null => (
  normalizePersonName(value) || null
);
