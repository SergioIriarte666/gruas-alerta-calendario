/**
 * Formatea un RUT chileno con puntos y guion mientras se escribe.
 * Ejemplo: "767698410" → "76.769.841-0"
 */
export function formatRut(value: string): string {
  // Limpiar todo excepto dígitos y K/k
  const clean = value.replace(/[^0-9kK]/g, '').toUpperCase();

  if (clean.length <= 1) return clean;

  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);

  // Agregar puntos cada 3 dígitos de derecha a izquierda
  const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return `${formattedBody}-${dv}`;
}

/**
 * Normaliza un RUT chileno al formato estándar XX.XXX.XXX-D (puntos de miles,
 * guion y dígito verificador en mayúscula si es K). Idempotente:
 * normalizeRut('96.511.460-2') === '96.511.460-2'.
 * Si el valor no parece un RUT (sin dígito verificador o no numérico) se
 * devuelve con trim() tal cual, sin lanzar error.
 * Ejemplos: '78924030-2' → '78.924.030-2'; '77822478-k' → '77.822.478-K'.
 */
export function normalizeRut(raw: string): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return trimmed;

  const clean = trimmed.replace(/[.\s-]/g, '').toUpperCase();
  const match = clean.match(/^(\d+)([0-9K])$/);
  if (!match) return trimmed;

  const [, body, dv] = match;
  const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${formattedBody}-${dv}`;
}
