/**
 * Matching tolerante contra los catálogos vehicle_brands / vehicle_models.
 *
 * El historial de `services` guarda la marca y el modelo como texto libre, así
 * que arrastra basura ('Nissan ' con espacio final, casing inconsistente,
 * espacios internos dobles). Comparar el string crudo contra el catálogo hace
 * que el Select caiga al placeholder y el formulario quede a medio llenar.
 * Toda comparación catálogo↔texto histórico pasa por acá.
 */

/** Mayúsculas, sin acentos, sin espacios sobrantes ni internos dobles. */
export const normalizeCatalogName = (text: string): string =>
  text
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/**
 * Limpieza mínima para persistir marca/modelo en `services`: recorta y colapsa
 * espacios sin tocar acentos ni casing (el texto se imprime en actas y PDFs).
 * Preserva null/undefined para no alterar la semántica de los payloads.
 */
export const normalizeVehicleFreeText = (value: string | null | undefined): string | null | undefined => {
  if (value == null) return value;
  return value.trim().replace(/\s+/g, ' ');
};

/** true si ambos nombres son el mismo una vez normalizados. */
export const catalogNameEquals = (a: string | null | undefined, b: string | null | undefined): boolean => {
  if (!a || !b) return false;
  const na = normalizeCatalogName(a);
  return na.length > 0 && na === normalizeCatalogName(b);
};

/**
 * Busca en el catálogo el item cuyo nombre calza con `raw` (texto histórico).
 * Devuelve el item completo: el Select usa `item.id` como value, nunca el
 * string crudo.
 */
export const findCatalogMatch = <T extends { name: string | null }>(
  items: T[],
  raw: string | null | undefined,
): T | undefined => {
  if (!raw) return undefined;
  const target = normalizeCatalogName(raw);
  if (!target) return undefined;
  return items.find(item => item.name != null && normalizeCatalogName(item.name) === target);
};
