import * as XLSX from 'xlsx';
import type { ClientPaymentRow } from '@/types/clientPaymentImport';

export const HEADER_REFERENCIA = 'Referencia';
export const HEADER_MONTO = 'Monto';
export const HEADER_DETALLE = 'Detalle';
export const HEADER_FECHA = 'Fecha de Pago';

function excelSerialToISODate(serial: number): string {
  const date = new Date((serial - 25569) * 86400 * 1000);
  date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseFechaPago(value: unknown): string {
  if (typeof value === 'number') {
    return excelSerialToISODate(value);
  }
  const str = String(value ?? '').trim();
  const match = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!match) return '';
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
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
