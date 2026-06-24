import * as XLSX from 'xlsx';
import { fromZonedTime } from 'date-fns-tz';
import { businessClock } from '@/utils/businessClock';

export type LegacyRow = {
  received_at: string | null;
  adjuster: string;
  reference: string;
  manual_folio: string;
  expediente: string;
  insurer: string;
  service_type: string;
  vehicle_brand: string;
  vehicle_type: string;
  license_plate: string;
  vin: string;
  origin: string;
  destination: string;
  crane_label: string;
  operator_label: string;
  subtotal_clp: number;
  total_clp: number;
  observations: string;
  _rowIndex: number;
  _invalidDate: boolean;
};

export type PreviewStats = {
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  invalid_row_numbers: number[];
  period_from: string | null;
  period_to: string | null;
  total_subtotal_clp: number;
  total_total_clp: number;
  top_insurers: { name: string; count: number }[];
  top_operators: { name: string; count: number }[];
  top_service_types: { name: string; count: number }[];
  top_cranes: { name: string; count: number }[];
};

const EXPECTED_HEADERS = [
  'Fecha/hora de recepción',
  'Ajustador',
  'Referencia',
  'Folio (Manual)',
  'EXPEDIENTE',
  'Aseguradora',
  'Tipo de servicio',
  'Marca del vehículo',
  'Tipo de vehículo',
  'Placas del vehículo',
  'No. serie del vehículo (VIN)',
  'Origen',
  'Destino',
  'Grúa',
  'Operador',
  'Subtotal',
  'Observaciones internas',
  'Total',
] as const;

const cleanText = (value: unknown): string =>
  value == null ? '' : String(value).replace(/\xa0/g, ' ').replace(/\s+/g, ' ').trim();

const parseAmount = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  const parsed = Number.parseInt(cleanText(value).replace(/,/g, ''), 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const isValidCalendarDate = (year: number, month: number, day: number) => {
  const candidate = new Date(Date.UTC(year, month - 1, day, 12));
  return candidate.getUTCFullYear() === year
    && candidate.getUTCMonth() === month - 1
    && candidate.getUTCDate() === day;
};

const parseReceivedAt = (value: unknown): string | null => {
  const normalized = cleanText(value)
    .replace(/a\.\s*m\./i, 'AM')
    .replace(/p\.\s*m\./i, 'PM');

  const match = normalized.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i,
  );
  if (!match) return null;

  const [, dayRaw, monthRaw, yearRaw, hourRaw, minuteRaw, secondRaw, meridiemRaw] = match;
  const day = Number(dayRaw);
  const month = Number(monthRaw);
  const year = Number(yearRaw);
  if (!isValidCalendarDate(year, month, day)) return null;

  let hour = hourRaw == null ? 12 : Number(hourRaw);
  const minute = minuteRaw == null ? 0 : Number(minuteRaw);
  const second = secondRaw == null ? 0 : Number(secondRaw);
  const meridiem = meridiemRaw?.toUpperCase();

  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (meridiem === 'AM') hour = hour === 12 ? 0 : hour;
    if (meridiem === 'PM') hour = hour === 12 ? 12 : hour + 12;
  }
  if (hour > 23 || minute > 59 || second > 59) return null;

  const localTimestamp = `${yearRaw}-${monthRaw.padStart(2, '0')}-${dayRaw.padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
  return fromZonedTime(localTimestamp, businessClock.timezone()).toISOString();
};

export async function parseLegacyServicesXLSX(file: File): Promise<LegacyRow[]> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const worksheet = workbook.Sheets.Reporte;
  if (!worksheet) {
    throw new Error("El archivo no contiene la hoja obligatoria 'Reporte'.");
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    range: 3,
    header: 1,
    defval: '',
    raw: false,
  });
  const headerRow = rows[0] ?? [];
  const actualHeaders = headerRow.slice(1, 19).map(cleanText);
  const headerMismatch = EXPECTED_HEADERS.findIndex((header, index) => actualHeaders[index] !== header);
  if (headerMismatch !== -1 || actualHeaders.length !== EXPECTED_HEADERS.length) {
    const position = headerMismatch === -1 ? EXPECTED_HEADERS.length : headerMismatch;
    throw new Error(
      `Formato inválido en la fila 4, columna ${String.fromCharCode(66 + position)}. Se esperaba "${EXPECTED_HEADERS[position] ?? 'sin columnas adicionales'}" y se encontró "${actualHeaders[position] ?? ''}".`,
    );
  }

  return rows.slice(1).flatMap((rawRow, index) => {
    const cells = rawRow.slice(1, 19);
    if (cells.every((cell) => cleanText(cell) === '')) return [];
    const receivedAt = parseReceivedAt(cells[0]);
    return [{
      received_at: receivedAt,
      adjuster: cleanText(cells[1]),
      reference: cleanText(cells[2]),
      manual_folio: cleanText(cells[3]),
      expediente: cleanText(cells[4]),
      insurer: cleanText(cells[5]),
      service_type: cleanText(cells[6]),
      vehicle_brand: cleanText(cells[7]),
      vehicle_type: cleanText(cells[8]),
      license_plate: cleanText(cells[9]),
      vin: cleanText(cells[10]),
      origin: cleanText(cells[11]),
      destination: cleanText(cells[12]),
      crane_label: cleanText(cells[13]),
      operator_label: cleanText(cells[14]),
      subtotal_clp: parseAmount(cells[15]),
      observations: cleanText(cells[16]),
      total_clp: parseAmount(cells[17]),
      _rowIndex: index + 5,
      _invalidDate: receivedAt === null,
    } satisfies LegacyRow];
  });
}

const topWithOthers = (values: string[], limit = 8) => {
  const counts = new Map<string, number>();
  values.forEach((value) => {
    const name = value.trim() || 'Sin información';
    counts.set(name, (counts.get(name) ?? 0) + 1);
  });
  const sorted = [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'es'));
  const top = sorted.slice(0, limit);
  const others = sorted.slice(limit).reduce((sum, item) => sum + item.count, 0);
  return others > 0 ? [...top, { name: 'Otras', count: others }] : top;
};

export function computeLegacyPreviewStats(rows: LegacyRow[]): PreviewStats {
  const validRows = rows.filter((row) => !row._invalidDate && row.received_at);
  const dates = validRows.map((row) => row.received_at!.slice(0, 10)).sort();
  return {
    total_rows: rows.length,
    valid_rows: validRows.length,
    invalid_rows: rows.length - validRows.length,
    invalid_row_numbers: rows.filter((row) => row._invalidDate).map((row) => row._rowIndex),
    period_from: dates[0] ?? null,
    period_to: dates[dates.length - 1] ?? null,
    total_subtotal_clp: validRows.reduce((sum, row) => sum + row.subtotal_clp, 0),
    total_total_clp: validRows.reduce((sum, row) => sum + row.total_clp, 0),
    top_insurers: topWithOthers(validRows.map((row) => row.insurer)),
    top_operators: topWithOthers(validRows.map((row) => row.operator_label)),
    top_service_types: topWithOthers(validRows.map((row) => row.service_type)),
    top_cranes: topWithOthers(validRows.map((row) => row.crane_label)),
  };
}
