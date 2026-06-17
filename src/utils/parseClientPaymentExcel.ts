import * as XLSX from 'xlsx';
import type { ClientPaymentRow } from '@/types/clientPaymentImport';

export const HEADER_REFERENCIA = 'Referencia';
export const HEADER_MONTO = 'Monto';
export const HEADER_DETALLE = 'Detalle';
export const HEADER_FECHA = 'Fecha de Pago';

function parseFechaPago(raw: unknown): string {
  if (!raw) return '';

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    const sep = trimmed.includes('.') ? '.' : trimmed.includes('/') ? '/' : null;
    if (!sep) return '';
    const parts = trimmed.split(sep);
    if (parts.length !== 3) return '';
    const [dd, mm, yyyy] = parts;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }

  if (typeof raw === 'number') {
    const date = XLSX.SSF.parse_date_code(raw);
    const mm = String(date.m).padStart(2, '0');
    const dd = String(date.d).padStart(2, '0');
    return `${date.y}-${mm}-${dd}`;
  }

  if (raw instanceof Date) {
    const yyyy = raw.getFullYear();
    const mm = String(raw.getMonth() + 1).padStart(2, '0');
    const dd = String(raw.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  return '';
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

        const rows: ClientPaymentRow[] = [];
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
        resolve(rows);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsBinaryString(file);
  });
}
