/**
 * Utilidades puras del IVA (F29). Aritmética de meses en string para no depender
 * de `new Date()` en lógica de negocio (evita corrimientos por zona horaria).
 */
import { safeParseDateOnly } from '@/utils/timezoneUtils';

/** 'YYYY-MM' + delta meses → 'YYYY-MM' (puede ser negativo). */
export const addMonths = (ym: string, delta: number): string => {
  const [y, m] = ym.split('-').map(Number);
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, '0')}`;
};

/** 'YYYY-MM' → primer día del mes 'YYYY-MM-01' (para filtros >= / <). */
export const monthStart = (ym: string): string => `${ym}-01`;

/** 'YYYY-MM' → 'Julio 2026' (fecha civil, sin corrimiento de zona horaria). */
export const monthLabel = (ym: string): string => {
  const label = safeParseDateOnly(`${ym}-01`).toLocaleDateString('es-CL', {
    month: 'long',
    year: 'numeric',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

/**
 * IVA a separar para el F29 al registrar el pago de una o varias facturas.
 * Como no hay pagos parciales, factura pagada = IVA completo apartado, así que
 * el monto es simplemente la suma del IVA (vat) de cada factura.
 */
export interface IvaToSeparateItem {
  folio: string;
  iva: number;
}
export interface IvaToSeparate {
  total: number;
  items: IvaToSeparateItem[];
}

export const computeIvaToSeparate = (
  invoices: Array<{ folio: string; vat: number | null | undefined }>,
): IvaToSeparate => {
  const items = invoices.map((inv) => ({ folio: inv.folio, iva: Number(inv.vat || 0) }));
  const total = items.reduce((sum, item) => sum + item.iva, 0);
  return { total, items };
};
