/**
 * Helpers puros de la plantilla Excel de carga masiva de Servicios.
 * Sin dependencias de supabase ni de exceljs para poder probarlos en vitest.
 */

/** Orden exacto de columnas de la hoja "Servicios" (A..U). El importador mapea por nombre. */
export const SERVICE_TEMPLATE_HEADERS = [
  'Folio',
  'Fecha Solicitud',
  'Fecha Servicio',
  'Cliente RUT',
  'Cliente Nombre',
  'Cliente Departamento',
  'Vehículo Marca',
  'Vehículo Modelo',
  'Patente',
  'Origen',
  'Destino',
  'Tipo Servicio',
  'Valor',
  'Grúa Patente',
  'Operador RUT',
  'Comisión Operador',
  'Observaciones',
  'Combustible',
  'Viaticos',
  'Peajes',
  'Operador Nombre',
] as const;

/** Filas con fórmulas y listas desplegables (2..151). */
export const SERVICE_TEMPLATE_DATA_ROWS = 150;

/**
 * SRV-826894 no es un folio de negocio (fallback por timestamp, 22-07-2026). La
 * secuencia de BD ignora todo lo que esté sobre este umbral y aquí se hace lo mismo.
 */
export const FOLIO_OUTLIER_THRESHOLD = 100000;

export interface ClientCatalogRow {
  label: string;
  name: string;
  rut: string;
  department: string;
}

export interface OperatorCatalogRow {
  label: string;
  name: string;
  rut: string;
}

/** Orden alfabético en español (insensible a mayúsculas y acentos) para todos los catálogos. */
export const catalogCollator = new Intl.Collator('es', { sensitivity: 'base' });
const collator = catalogCollator;

const normalizeKey = (text: string): string =>
  text.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const countBy = (values: string[]): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
};

/**
 * Etiqueta visible en la lista desplegable de clientes: el nombre a secas cuando es
 * único entre los activos, `Nombre — Departamento` cuando el mismo nombre tiene más de
 * un registro (cada departamento de un RUT es una unidad distinta) y, si aun así choca,
 * se agrega el RUT para que VLOOKUP nunca resuelva al cliente equivocado.
 */
export function buildClientCatalog(
  clients: Array<{ name: string | null; rut: string | null; department: string | null }>,
): ClientCatalogRow[] {
  const rows = clients
    .map(c => ({
      name: (c.name ?? '').trim(),
      rut: (c.rut ?? '').trim(),
      department: (c.department ?? '').trim(),
    }))
    .filter(c => c.name !== '');

  const nameCounts = countBy(rows.map(c => normalizeKey(c.name)));
  const firstPass = rows.map(c => ({
    ...c,
    label: (nameCounts.get(normalizeKey(c.name)) ?? 0) > 1 && c.department
      ? `${c.name} — ${c.department}`
      : c.name,
  }));

  const labelCounts = countBy(firstPass.map(c => normalizeKey(c.label)));
  return firstPass
    .map(c => ({
      ...c,
      label: (labelCounts.get(normalizeKey(c.label)) ?? 0) > 1 && c.rut
        ? `${c.label} (${c.rut})`
        : c.label,
    }))
    .sort((a, b) => collator.compare(a.label, b.label));
}

/** Nombre del operador como etiqueta; si dos operadores comparten nombre se agrega el RUT. */
export function buildOperatorCatalog(
  operators: Array<{ name: string | null; rut: string | null }>,
): OperatorCatalogRow[] {
  const rows = operators
    .map(o => ({ name: (o.name ?? '').trim(), rut: (o.rut ?? '').trim() }))
    .filter(o => o.name !== '');

  const nameCounts = countBy(rows.map(o => normalizeKey(o.name)));
  return rows
    .map(o => ({
      ...o,
      label: (nameCounts.get(normalizeKey(o.name)) ?? 0) > 1 && o.rut ? `${o.name} (${o.rut})` : o.name,
    }))
    .sort((a, b) => collator.compare(a.label, b.label));
}

/**
 * Máximo numérico real de los folios SRV-NNNN, ignorando los outliers por sobre el
 * umbral. Devuelve 0 si no hay ninguno válido.
 */
export function computeMaxFolioNumber(
  folios: Array<string | null | undefined>,
  outlierThreshold = FOLIO_OUTLIER_THRESHOLD,
): number {
  let max = 0;
  for (const folio of folios) {
    const match = typeof folio === 'string' ? folio.trim().match(/^SRV-(\d+)$/i) : null;
    if (!match) continue;
    const n = Number(match[1]);
    if (Number.isFinite(n) && n < outlierThreshold && n > max) max = n;
  }
  return max;
}
