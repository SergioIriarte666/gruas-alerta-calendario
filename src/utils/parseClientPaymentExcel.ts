import * as XLSX from 'xlsx';
import type { ClientPaymentRow } from '@/types/clientPaymentImport';

export const HEADER_REFERENCIA = 'Referencia';
export const HEADER_MONTO = 'Monto';
export const HEADER_DETALLE = 'Detalle';
export const HEADER_FECHA = 'Fecha de Pago';

function parseFechaPago(raw: unknown): string | null {
  if (!raw) return null;

  // Caso A: string con formato dd.mm.yyyy o dd/mm/yyyy
  if (typeof raw === 'string' && raw.trim()) {
    const str = raw.trim();
    // Detectar separador
    const sep = str.includes('.') ? '.' : str.includes('/') ? '/' : null;
    if (sep) {
      const parts = str.split(sep);
      if (parts.length === 3) {
        const [dd, mm, yyyy] = parts;
        if (yyyy.length === 4 && !isNaN(Number(dd)) && !isNaN(Number(mm))) {
          return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
        }
      }
    }
    // Caso: ya viene en formato yyyy-mm-dd
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    return null;
  }

  // Caso B: número serial de Excel
  if (typeof raw === 'number') {
    // Convertir serial de Excel a fecha sin usar new Date() con strings
    // Excel usa días desde 1900-01-01 (con bug del año bisiesto 1900)
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const ms = excelEpoch.getTime() + raw * 86400000;
    const d = new Date(ms);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // Caso C: objeto Date de JS - usar componentes UTC para evitar timezone
  if (raw instanceof Date) {
    const yyyy = raw.getUTCFullYear();
    const mm = String(raw.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(raw.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  return null;
}

function parseMonto(value: unknown): number {
  if (typeof value === 'number') return Math.abs(value);
  const str = String(value ?? '').replace(/\./g, '').replace(',', '.').trim();
  const num = Number(str);
  return isNaN(num) ? 0 : Math.abs(num);
}

export function parseClientPaymentExcel(file: File): Promise<ClientPaymentRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const sheetRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: true });

        const rows: Array<Omit<ClientPaymentRow, 'fechaPago'> & { fechaPago: string | null }> = [];
        for (const sheetRow of sheetRows) {
          const referencia = String(sheetRow[HEADER_REFERENCIA] ?? '').trim();
          if (!referencia) continue;

          rows.push({
            id: crypto.randomUUID(),
            referencia,
            monto: parseMonto(sheetRow[HEADER_MONTO]),
            detalle: String(sheetRow[HEADER_DETALLE] ?? '').trim(),
            fechaPago: parseFechaPago(sheetRow[HEADER_FECHA]),
          });
        }
        resolve(rows as ClientPaymentRow[]);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsBinaryString(file);
  });
}
