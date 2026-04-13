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
