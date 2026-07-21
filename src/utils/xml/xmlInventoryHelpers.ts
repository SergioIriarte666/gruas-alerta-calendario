import type { XMLDocumentData, XMLDocumentItem } from '@/types/suppliers';

/**
 * Utilidades de cómputo y normalización para XMLInventoryUpload.
 * Extraídas del componente para testing y reutilización independientes.
 */

export const normalizeText = (value: string | null | undefined) =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export const normalizeCode = (value: string | null | undefined) =>
  (value || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().trim();

/**
 * Códigos placeholder ("0", "", solo ceros) NO deben usarse para matching/SKU,
 * porque XMLs como los de Jomial traen VlrCodigo=0 para todas las líneas y
 * terminan fusionando productos distintos en uno solo.
 */
export const isPlaceholderCode = (value: string | null | undefined) => {
  const n = normalizeCode(value);
  return !n || /^0+$/.test(n);
};

export const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);

export const computeLineSubtotal = (line: XMLDocumentItem) => {
  if (typeof line.subtotal === 'number' && Number.isFinite(line.subtotal)) return line.subtotal;
  if (typeof line.quantity === 'number' && typeof line.unit_price === 'number') {
    return Number(line.quantity) * Number(line.unit_price);
  }
  return 0;
};

export const computeLineTaxAmount = (line: XMLDocumentItem) => {
  if (typeof line.tax_amount === 'number' && Number.isFinite(line.tax_amount)) return line.tax_amount;
  const subtotal = computeLineSubtotal(line);
  const taxRate = typeof line.tax_rate === 'number' && Number.isFinite(line.tax_rate) ? line.tax_rate : 0;
  return subtotal * (taxRate / 100);
};

export const computeLineTotal = (line: XMLDocumentItem) => {
  if (typeof line.total === 'number' && Number.isFinite(line.total) && line.total > 0) return line.total;
  return computeLineSubtotal(line) + computeLineTaxAmount(line);
};

/**
 * Monto de un gasto cuando se selecciona un subconjunto de líneas del DTE.
 *
 * Aritmética verificada contra el parser (xmlSupplierParser): cada línea guarda
 * `MontoItem` como NETO (`subtotal`) y el IVA se aplica por línea según `IndExe`
 * (`tax_amount`, 19% salvo exentas). Por eso `computeLineTotal` ya devuelve el
 * BRUTO por línea y la suma de los brutos de todas las líneas coincide con el
 * `MntTotal` del documento (`total_amount`). Esto cubre ambos escenarios sin
 * ramas especiales: documentos afectos (IVA repartido por línea, respetando
 * líneas exentas mezcladas) y documentos exentos (tax_rate 0 → bruto = neto,
 * suma directa de MontoItem == total).
 *
 * - Todas las líneas seleccionadas → se retorna `docTotal` exacto, evitando
 *   drift de redondeo por línea frente a `MntTotal` (sin regresión con el
 *   comportamiento actual: 1 gasto = total del documento).
 * - Subconjunto → suma de los brutos por línea (cada uno redondeado a peso, para
 *   que el total cuadre exactamente con lo que muestra la tabla de detalle).
 */
export const computeSelectedTotal = (
  items: XMLDocumentItem[] | undefined,
  selectedIndices: Set<number>,
  docTotal: number,
): number => {
  if (!items || items.length === 0) return docTotal;
  const allSelected = items.every((_, index) => selectedIndices.has(index));
  if (allSelected) return docTotal;
  return items.reduce(
    (sum, item, index) => (selectedIndices.has(index) ? sum + Math.round(computeLineTotal(item)) : sum),
    0,
  );
};

export const buildProductDescription = (doc: XMLDocumentData) => {
  const base = (doc.items || [])
    .slice(0, 8)
    .map((item) => {
      const code = item.product_code ? `[${item.product_code}] ` : '';
      return `${code}${item.description}`.trim();
    })
    .filter(Boolean)
    .join(', ');

  const value = base || doc.description || `Factura ${doc.folio}`;
  const trimmed = value.trim();
  if (trimmed.length >= 10) return trimmed.slice(0, 500);
  return `Factura importada ${doc.folio}`.slice(0, 500);
};

export const buildCostDescription = (doc: XMLDocumentData, supplierName: string) => {
  const itemDescriptions = (doc.items || [])
    .map((item) => item.description?.trim())
    .filter((d) => d && d.length > 0);

  const isSingleItem = itemDescriptions.length <= 1;

  const segments = [supplierName?.trim()];
  if (isSingleItem && itemDescriptions.length === 1) {
    segments.push(itemDescriptions[0]!);
  }

  const description = segments.filter(Boolean).join(' ').trim();
  return (description || `Factura XML Bodega ${doc.folio}`).slice(0, 255);
};

export const buildImportSuccessMessage = (params: {
  importedCount: number;
  hasImmediateConsumption: boolean;
  craneLabel?: string | null;
}) => {
  const documentsLabel = `${params.importedCount} factura(s) XML`;

  if (params.hasImmediateConsumption) {
    return {
      title: `${documentsLabel} importada(s) correctamente`,
      description: `Se registró la entrada a bodega y la salida inmediata hacia ${params.craneLabel || 'la grúa seleccionada'}.`,
    };
  }

  return {
    title: `${documentsLabel} importada(s) correctamente`,
    description: 'Se registró el ingreso a bodega y la trazabilidad en Costos y Proveedores.',
  };
};

export const getLineKey = (folio: string, lineNumber: number) => `${folio}-${lineNumber}`;
