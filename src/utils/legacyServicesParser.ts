import * as XLSX from 'xlsx';
import { fromZonedTime } from 'date-fns-tz';
import { businessClock } from '@/utils/businessClock';
import { createLogger } from '@/lib/logger';
import { toTitleCaseEs } from '@/utils/textNormalization';

const logger = createLogger('LegacyServicesParser');

type NormalizationField = 'operator_label' | 'insurer';
type NormalizationTrace = { field: NormalizationField; before: string; after: string };

export type LegacyRow = {
  received_at: string | null;
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
  _isTemplateExample: boolean;
  _normalizations?: NormalizationTrace[];
  _normalizationChangeCount?: number;
};

export type OverlapStats = {
  total_overlapping: number;
  overlap_samples: {
    received_at: string;
    license_plate: string;
    manual_folio: string;
    existing_filename: string;
  }[];
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
  normalization_applied: {
    total_normalizations: number;
    operators_unified: { before: string[]; after: string }[];
    insurers_unified: { before: string[]; after: string }[];
  };
  overlap_stats: OverlapStats;
};

const LEGACY_HEADERS = [
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

const TEMPLATE_HEADERS = [
  'Fecha/hora de recepción',
  'Folio (Manual)',
  'EXPEDIENTE',
  'Aseguradora',
  'Tipo de servicio',
  'Marca del vehículo',
  'Tipo de vehículo',
  'Placas del vehículo',
  'No. serie del vehículo',
  'Origen',
  'Destino',
  'Grúa',
  'Operador',
  'Subtotal',
  'Observaciones internas',
  'Total',
] as const;

export const LEGACY_SERVICE_TYPE_SYNONYMS: Record<string, string> = {
  'grua livianos': 'Grua Liviano',
  'grua liviano': 'Grua Liviano',
  'grua pesado': 'Grua Pesados',
  'grua pesados': 'Grua Pesados',
  'apertura puertas': 'Apertura de Puertas',
  'cambio neumaticos': 'Cambio de Neumáticos',
  'revision tecnica': 'Revisión Técnica',
  'revision previaje': 'Revisión Previaje',
};

const cleanText = (value: unknown): string =>
  value == null ? '' : String(value).replace(/\xa0/g, ' ').replace(/\s+/g, ' ').trim();

const toTitleCaseAlwaysEs = (value: string): string => {
  const cleaned = cleanText(value);
  return cleaned ? toTitleCaseEs(cleaned.toLocaleUpperCase('es-CL')) : '';
};

const normalizeInsurer = (value: string) => {
  const cleaned = cleanText(value);
  if (/^[A-Z]{2,}(\s|$)/.test(cleaned)) return cleaned;
  return toTitleCaseAlwaysEs(cleaned);
};

const normalizeServiceType = (value: string) => {
  const cleaned = cleanText(value);
  const mapped = LEGACY_SERVICE_TYPE_SYNONYMS[cleaned.toLocaleLowerCase('es-CL')];
  return mapped ?? toTitleCaseAlwaysEs(cleaned);
};

const normalizeVehicleBrand = (value: string) => {
  const titleCased = toTitleCaseAlwaysEs(value);
  return titleCased === 'Bmw' ? 'BMW' : titleCased;
};

const normalizePlateLikeValue = (value: string) => cleanText(value).replace(/\s+/g, '').toUpperCase();

const normalizeCraneLabel = (value: string) => {
  const cleaned = cleanText(value);
  if (/^[A-Z]{4}-\d{2}$/i.test(cleaned.replace(/\s+/g, ''))) {
    return normalizePlateLikeValue(cleaned);
  }
  return toTitleCaseAlwaysEs(cleaned);
};

const appendTrace = (traces: NormalizationTrace[], field: NormalizationField, before: string, after: string) => {
  if (before !== after) traces.push({ field, before, after });
};

export function normalizeLegacyRow(raw: LegacyRow): LegacyRow {
  const originalOperator = cleanText(raw.operator_label);
  const originalInsurer = cleanText(raw.insurer);
  const normalizations: NormalizationTrace[] = [];

  const normalized: LegacyRow = {
    ...raw,
    manual_folio: cleanText(raw.manual_folio),
    expediente: cleanText(raw.expediente),
    insurer: normalizeInsurer(raw.insurer),
    service_type: normalizeServiceType(raw.service_type),
    vehicle_brand: normalizeVehicleBrand(raw.vehicle_brand),
    vehicle_type: toTitleCaseAlwaysEs(raw.vehicle_type),
    license_plate: normalizePlateLikeValue(raw.license_plate),
    vin: normalizePlateLikeValue(raw.vin),
    origin: cleanText(raw.origin),
    destination: cleanText(raw.destination),
    crane_label: normalizeCraneLabel(raw.crane_label),
    operator_label: toTitleCaseAlwaysEs(raw.operator_label),
    observations: cleanText(raw.observations),
  };

  appendTrace(normalizations, 'operator_label', originalOperator, normalized.operator_label);
  appendTrace(normalizations, 'insurer', originalInsurer, normalized.insurer);

  const stringFields: (keyof Pick<LegacyRow,
    'manual_folio'
    | 'expediente'
    | 'insurer'
    | 'service_type'
    | 'vehicle_brand'
    | 'vehicle_type'
    | 'license_plate'
    | 'vin'
    | 'origin'
    | 'destination'
    | 'crane_label'
    | 'operator_label'
    | 'observations'
  >)[] = [
    'manual_folio',
    'expediente',
    'insurer',
    'service_type',
    'vehicle_brand',
    'vehicle_type',
    'license_plate',
    'vin',
    'origin',
    'destination',
    'crane_label',
    'operator_label',
    'observations',
  ];

  const changeCount = stringFields.reduce((count, field) => {
    return count + (cleanText(raw[field]) !== normalized[field] ? 1 : 0);
  }, 0);

  return {
    ...normalized,
    _normalizations: normalizations,
    _normalizationChangeCount: changeCount,
  };
}

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

const isTemplateExample = (row: LegacyRow, rawReceivedAt: unknown): boolean => {
  const normalizedDate = cleanText(rawReceivedAt)
    .replace(/a\.\s*m\./i, 'AM')
    .replace(/p\.\s*m\./i, 'PM')
    .toUpperCase();

  return row.manual_folio === '2150'
    && row.license_plate.toUpperCase() === 'JVWP-22'
    && normalizedDate === '01/09/2020 12:08:00 PM'
    && row.subtotal_clp === 30000;
};

export async function parseLegacyServicesXLSX(file: File): Promise<LegacyRow[]> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const isTemplateFormat = Boolean(workbook.Sheets['Servicios Legacy']);
  const worksheet = workbook.Sheets['Servicios Legacy'] ?? workbook.Sheets.Reporte;
  if (!worksheet) {
    throw new Error("No se encontró la hoja 'Servicios Legacy' ni 'Reporte' en el archivo.");
  }
  if (!isTemplateFormat) {
    logger.info("Archivo en formato legacy detectado (hoja 'Reporte'). Las columnas Ajustador y Referencia se omitirán automáticamente.");
  }

  const headerRowIndex = isTemplateFormat ? 0 : 3;
  const firstColumnIndex = isTemplateFormat ? 0 : 1;
  const headerExcelRow = headerRowIndex + 1;
  const expectedHeaders = isTemplateFormat ? TEMPLATE_HEADERS : LEGACY_HEADERS;
  const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    range: headerRowIndex,
    header: 1,
    defval: '',
    raw: false,
  });
  const headerRow = rows[0] ?? [];
  const actualHeaders = headerRow.slice(firstColumnIndex, firstColumnIndex + expectedHeaders.length).map(cleanText);
  const headerMismatch = expectedHeaders.findIndex((header, index) => actualHeaders[index] !== header);
  if (headerMismatch !== -1 || actualHeaders.length !== expectedHeaders.length) {
    const position = headerMismatch === -1 ? expectedHeaders.length : headerMismatch;
    const excelColumn = String.fromCharCode(65 + firstColumnIndex + position);
    throw new Error(
      `Formato inválido en la hoja '${isTemplateFormat ? 'Servicios Legacy' : 'Reporte'}', fila ${headerExcelRow}, columna ${excelColumn}. Se esperaba "${expectedHeaders[position] ?? 'sin columnas adicionales'}" y se encontró "${actualHeaders[position] ?? ''}".`,
    );
  }

  const parsedRows = rows.slice(1).flatMap((rawRow, index) => {
    const sourceCells = rawRow.slice(firstColumnIndex, firstColumnIndex + expectedHeaders.length);
    const cells = isTemplateFormat
      ? sourceCells
      : [sourceCells[0], ...sourceCells.slice(3)];
    if (cells.every((cell) => cleanText(cell) === '')) return [];
    const receivedAt = parseReceivedAt(cells[0]);
    const parsedRow: LegacyRow = {
      received_at: receivedAt,
      manual_folio: cleanText(cells[1]),
      expediente: cleanText(cells[2]),
      insurer: cleanText(cells[3]),
      service_type: cleanText(cells[4]),
      vehicle_brand: cleanText(cells[5]),
      vehicle_type: cleanText(cells[6]),
      license_plate: cleanText(cells[7]),
      vin: cleanText(cells[8]),
      origin: cleanText(cells[9]),
      destination: cleanText(cells[10]),
      crane_label: cleanText(cells[11]),
      operator_label: cleanText(cells[12]),
      subtotal_clp: parseAmount(cells[13]),
      observations: cleanText(cells[14]),
      total_clp: parseAmount(cells[15]),
      _rowIndex: index + headerExcelRow + 1,
      _invalidDate: receivedAt === null,
      _isTemplateExample: false,
    };
    const normalizedRow = normalizeLegacyRow(parsedRow);
    if (index === 0) normalizedRow._isTemplateExample = isTemplateExample(normalizedRow, cells[0]);
    return [normalizedRow];
  });

  const importedRows = parsedRows.filter((row) => !row._isTemplateExample);
  const normalizationChanges = importedRows.reduce((sum, row) => sum + (row._normalizationChangeCount ?? 0), 0);
  logger.info(`Normalización aplicada: ${normalizationChanges} cambios sobre ${importedRows.length} filas`);
  return importedRows;
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

const unifiedNormalizations = (rows: LegacyRow[], field: NormalizationField) => {
  const grouped = new Map<string, Set<string>>();
  rows.forEach((row) => {
    row._normalizations
      ?.filter((trace) => trace.field === field)
      .forEach((trace) => {
        const originals = grouped.get(trace.after) ?? new Set<string>();
        originals.add(trace.before);
        originals.add(trace.after);
        grouped.set(trace.after, originals);
      });
  });

  return [...grouped]
    .map(([after, originals]) => ({ before: [...originals].sort((a, b) => a.localeCompare(b, 'es')), after }))
    .filter((item) => item.before.length >= 2)
    .sort((a, b) => b.before.length - a.before.length || a.after.localeCompare(b.after, 'es'))
    .slice(0, 10);
};

export function computeLegacyPreviewStats(rows: LegacyRow[]): PreviewStats {
  const validRows = rows.filter((row) => !row._invalidDate && row.received_at);
  const dates = validRows.map((row) => row.received_at!.slice(0, 10)).sort();
  const operatorsUnified = unifiedNormalizations(validRows, 'operator_label');
  const insurersUnified = unifiedNormalizations(validRows, 'insurer');
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
    normalization_applied: {
      total_normalizations: validRows.reduce((sum, row) => sum + (row._normalizationChangeCount ?? 0), 0),
      operators_unified: operatorsUnified,
      insurers_unified: insurersUnified,
    },
    overlap_stats: {
      total_overlapping: 0,
      overlap_samples: [],
    },
  };
}
