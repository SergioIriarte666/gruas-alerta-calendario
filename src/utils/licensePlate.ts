/**
 * Normaliza el espaciado de una patente (o VIN) antes de persistirla o
 * imprimirla.
 *
 * El input del formulario no recortaba, y 12 servicios quedaron con
 * 'TZSR-94 ' —con espacio final— en services.license_plate. Un espacio
 * invisible rompe la búsqueda por patente, duplica el vehículo en los
 * históricos y sale impreso así en el acta que ve el asegurador.
 *
 * Solo toca espacios: no fuerza mayúsculas ni formato, porque el campo también
 * admite VIN y textos libres ("SIN PATENTE") que no deben quedar pegados.
 */
export const normalizeLicensePlate = (value: string | null | undefined): string => (
  (value ?? '').trim().replace(/\s+/g, ' ')
);
