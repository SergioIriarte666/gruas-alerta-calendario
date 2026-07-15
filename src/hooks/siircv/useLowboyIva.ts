import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { DOC_TYPE_NOTA_CREDITO } from '@/types/siiRcv';

const logger = createLogger('LowboyIva');
const PAGE_SIZE = 1000;

/** Fila mínima necesaria para el cálculo de IVA F29. */
type IvaSourceRow = {
  book_type: string;
  doc_type: number;
  doc_date: string;
  tax_amount: number;
  net_amount: number;
  exempt_amount: number;
};

export type LowboyIvaMonth = {
  /** 'YYYY-MM' de doc_date (fecha civil, sin corrimiento de zona horaria). */
  month: string;
  ivaDebito: number;
  ivaCredito: number;
  remanenteAnterior: number;
  /** IVA a pagar del mes (>0). Si el determinado es <=0, es 0 y el saldo pasa como remanente. */
  ivaPagar: number;
  remanenteSiguiente: number;
  /** Neto+exento de ventas y compras (con signo -1 para NC), para el detalle secundario. */
  ventasNet: number;
  comprasNet: number;
  resultado: number;
};

export type LowboyIvaResult = {
  /** Meses en orden cronológico ascendente (orden de la cadena de remanentes). */
  months: LowboyIvaMonth[];
  /** Mes más reciente con registros (protagonista del héroe), o null si no hay datos. */
  latest: LowboyIvaMonth | null;
};

// Signo F29: las notas de crédito (61) restan; el resto suma.
const sign = (docType: number): number => (docType === DOC_TYPE_NOTA_CREDITO ? -1 : 1);

async function fetchAllRecords(entityRut: string): Promise<IvaSourceRow[]> {
  const rows: IvaSourceRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('sii_rcv_records')
      .select('book_type, doc_type, doc_date, tax_amount, net_amount, exempt_amount')
      .eq('entity_rut', entityRut)
      .order('doc_date', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) {
      logger.error('Error obteniendo registros para IVA', error);
      throw error;
    }
    rows.push(...((data ?? []) as IvaSourceRow[]));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

/** Agrega por mes y encadena el remanente en orden cronológico. */
function buildMonths(rows: IvaSourceRow[]): LowboyIvaMonth[] {
  type Acc = { ivaDebito: number; ivaCredito: number; ventasNet: number; comprasNet: number };
  const byMonth = new Map<string, Acc>();

  for (const row of rows) {
    // doc_date es 'YYYY-MM-DD' (columna date): el mes se extrae como string puro,
    // sin new Date(), evitando cualquier corrimiento de día por zona horaria.
    const month = row.doc_date.slice(0, 7);
    const acc = byMonth.get(month) ?? { ivaDebito: 0, ivaCredito: 0, ventasNet: 0, comprasNet: 0 };
    const s = sign(row.doc_type);
    const iva = Number(row.tax_amount) * s;
    const netoExento = (Number(row.net_amount) + Number(row.exempt_amount)) * s;
    if (row.book_type === 'venta') {
      acc.ivaDebito += iva;
      acc.ventasNet += netoExento;
    } else {
      acc.ivaCredito += iva;
      acc.comprasNet += netoExento;
    }
    byMonth.set(month, acc);
  }

  // Cadena de remanentes: siempre desde el primer mes con datos, en orden ascendente.
  // Los meses sin registros no alteran el remanente (débito=crédito=0 lo arrastran
  // intacto), por eso basta iterar los meses que sí tienen datos.
  const orderedMonths = [...byMonth.keys()].sort();
  const result: LowboyIvaMonth[] = [];
  let remanenteAnterior = 0;

  for (const month of orderedMonths) {
    const acc = byMonth.get(month)!;
    const ivaDebito = Math.round(acc.ivaDebito);
    const ivaCredito = Math.round(acc.ivaCredito);
    const determinado = ivaDebito - ivaCredito - remanenteAnterior;
    const ivaPagar = determinado > 0 ? determinado : 0;
    const remanenteSiguiente = determinado < 0 ? -determinado : 0;
    const ventasNet = Math.round(acc.ventasNet);
    const comprasNet = Math.round(acc.comprasNet);

    result.push({
      month,
      ivaDebito,
      ivaCredito,
      remanenteAnterior,
      ivaPagar,
      remanenteSiguiente,
      ventasNet,
      comprasNet,
      resultado: ventasNet - comprasNet,
    });

    remanenteAnterior = remanenteSiguiente;
  }

  return result;
}

export function useLowboyIva(entityRut: string) {
  return useQuery({
    queryKey: ['lowboy-iva', entityRut],
    enabled: !!entityRut,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<LowboyIvaResult> => {
      const rows = await fetchAllRecords(entityRut);
      const months = buildMonths(rows);
      return { months, latest: months.length > 0 ? months[months.length - 1] : null };
    },
  });
}
