/**
 * Tipos del cálculo de IVA débito fiscal (F29) de Grúas 5 Norte.
 *
 * POLÍTICA G5N (decisiones de negocio, no derivar de otra fuente):
 * - El F29 aquí considera SOLO IVA débito fiscal (IVA de facturas emitidas en el
 *   mes). No hay IVA crédito, PPM ni remanente de meses anteriores.
 * - No existen pagos parciales: una factura está pagada por su total o no lo está.
 *   Por eso el estado "pagada" se determina por status='paid' (la columna
 *   paid_amount no se mantiene y no es confiable).
 * - El F29 del mes M se declara/paga en el mes M+1 (vencimiento día 20).
 */

/** Fila de detalle por factura del período. */
export interface IvaF29InvoiceRow {
  id: string;
  folio: string;
  /** Número fiscal (identificador que se muestra en el detalle). */
  numeroFiscal: string | null;
  clientName: string;
  /** Fecha de emisión 'YYYY-MM-DD' (columna date, sin corrimiento de zona horaria). */
  issueDate: string;
  /** Neto (subtotal). */
  neto: number;
  /** IVA débito fiscal de la factura (columna vat). */
  iva: number;
  total: number;
  /** true si status='paid' (factura cobrada → IVA ya debería estar apartado). */
  paid: boolean;
  status: string;
  /** true si el IVA de esta factura ya fue apartado (marca manual en iva_f29_separations). */
  ivaSeparated: boolean;
}

/** Agregación de un mes ('YYYY-MM'). */
export interface IvaF29MonthSummary {
  /** 'YYYY-MM'. */
  month: string;
  /** Ventas netas del mes (suma de subtotal). */
  ventasNetas: number;
  /** IVA débito fiscal del mes = monto a pagar estimado (suma de vat). */
  ivaDebito: number;
  /** IVA de las facturas del mes ya cobradas (status='paid'). */
  ivaCobrado: number;
  /** Cantidad de facturas vigentes del mes. */
  count: number;
}

export interface IvaF29Result {
  /** Período seleccionado 'YYYY-MM'. */
  period: string;
  /** Totales del período seleccionado. */
  summary: IvaF29MonthSummary;
  /** Detalle por factura del período seleccionado. */
  invoices: IvaF29InvoiceRow[];
  /** Comparativo de los últimos 6 meses (orden cronológico ascendente). */
  comparison: IvaF29MonthSummary[];
}
