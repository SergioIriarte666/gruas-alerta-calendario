import * as XLSX from 'xlsx';
import type { Service } from '@/types';
import { getDisplayServiceValue } from '@/utils/serviceValueCalculations';

export interface BillingImportRow {
  id: string;
  sourceRow: number;
  quoteNumber: string;
  purchaseOrder: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  net: number;
  vat: number;
  total: number;
}

export type BillingAssignmentStatus = 'ready' | 'conflict' | 'unmatched';

export interface BillingInvoiceAssignment {
  row: BillingImportRow;
  services: Service[];
  serviceTotal: number;
  status: BillingAssignmentStatus;
  message?: string;
}

export type BillingQuoteGroupStatus = 'ready' | 'mismatch' | 'unmatched' | 'conflict';

export interface BillingQuoteGroup {
  quoteNumber: string;
  invoiceTotal: number;
  serviceTotal: number;
  difference: number;
  status: BillingQuoteGroupStatus;
  message?: string;
  assignments: BillingInvoiceAssignment[];
  services: Service[];
}

export interface BillingBatchPlan {
  groups: BillingQuoteGroup[];
  assignments: BillingInvoiceAssignment[];
  ready: boolean;
  invoiceCount: number;
  serviceCount: number;
  netTotal: number;
  blockingCount: number;
}

const stripDiacritics = (value: string): string =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const normalizeHeader = (value: unknown): string =>
  stripDiacritics(String(value ?? ''))
    .toLowerCase()
    .replace(/[º°#._-]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export const normalizeQuoteNumber = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/^COT(?:IZACION)?[-\s:]*/i, '')
    .replace(/\.0+$/, '')
    .replace(/\s+/g, '');

export const normalizePurchaseOrder = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/^(?:O\.?C\.?|ORDEN\s+DE\s+COMPRA)[-\s:]*/i, '')
    .replace(/\.0+$/, '')
    .replace(/\s+/g, '');

export const formatQuoteNumber = (value: unknown): string => `COT-${normalizeQuoteNumber(value)}`;
export const formatPurchaseOrder = (value: unknown): string => `OC-${normalizePurchaseOrder(value)}`;

const parseIntegerAmount = (value: unknown, label: string, sourceRow: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  const normalized = String(value ?? '').replace(/[^\d-]/g, '');
  const parsed = Number(normalized);
  if (!normalized || !Number.isFinite(parsed)) {
    throw new Error(`Fila ${sourceRow}: ${label} no es un monto válido.`);
  }
  return Math.round(parsed);
};

const dateToISO = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDaysISO = (iso: string, days: number): string => {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return dateToISO(date);
};

const parseDateValue = (value: unknown, label: string, sourceRow: number): string => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return dateToISO(value);

  if (typeof value === 'number' && Number.isFinite(value)) {
    const decoded = XLSX.SSF.parse_date_code(value);
    if (decoded) {
      return `${decoded.y}-${String(decoded.m).padStart(2, '0')}-${String(decoded.d).padStart(2, '0')}`;
    }
  }

  const text = String(value ?? '').trim();
  const isoDateTimeMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})T/);
  if (isoDateTimeMatch) {
    return `${isoDateTimeMatch[1]}-${isoDateTimeMatch[2].padStart(2, '0')}-${isoDateTimeMatch[3].padStart(2, '0')}`;
  }
  const isoMatch = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  }

  const localMatch = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (localMatch) {
    return `${localMatch[3]}-${localMatch[2].padStart(2, '0')}-${localMatch[1].padStart(2, '0')}`;
  }

  throw new Error(`Fila ${sourceRow}: ${label} no tiene una fecha reconocible.`);
};

type ColumnKey = 'invoice' | 'quote' | 'purchaseOrder' | 'issueDate' | 'dueDate' | 'net' | 'vat' | 'total';

const headerKey = (header: string): ColumnKey | null => {
  if (header.includes('cotizacion')) return 'quote';
  if (header === 'oc' || header === 'n oc' || header.includes('orden de compra')) return 'purchaseOrder';
  if (header.includes('fecha vencimiento') || header.includes('vencimiento')) return 'dueDate';
  if (header.includes('fecha emision') || header === 'emision') return 'issueDate';
  if (header === 'neto' || header.includes('monto neto')) return 'net';
  if (header === 'iva' || header.includes('19 iva')) return 'vat';
  if (header === 'total' || header === 'monto total') return 'total';
  if (header.includes('factura') || header === 'folio') return 'invoice';
  return null;
};

export const parseBillingRowsFromMatrix = (matrix: unknown[][]): BillingImportRow[] => {
  const headerRowIndex = matrix.findIndex((row) => {
    const headers = row.map(normalizeHeader);
    return headers.some((header) => header.includes('cotizacion'))
      && headers.some((header) => header.includes('factura') || header === 'folio')
      && headers.some((header) => header === 'oc' || header === 'n oc' || header.includes('orden de compra'));
  });

  if (headerRowIndex < 0) {
    throw new Error('No se encontró una fila de encabezados con Factura, Cotización y OC.');
  }

  const indexes = new Map<ColumnKey, number>();
  matrix[headerRowIndex].forEach((cell, index) => {
    const key = headerKey(normalizeHeader(cell));
    if (key && !indexes.has(key)) indexes.set(key, index);
  });

  const required: ColumnKey[] = ['invoice', 'quote', 'purchaseOrder', 'issueDate', 'net', 'vat', 'total'];
  const missing = required.filter((key) => !indexes.has(key));
  if (missing.length > 0) {
    throw new Error(`Faltan columnas obligatorias: ${missing.join(', ')}.`);
  }

  const get = (row: unknown[], key: ColumnKey): unknown => row[indexes.get(key) ?? -1];
  const parsed: BillingImportRow[] = [];

  for (let index = headerRowIndex + 1; index < matrix.length; index += 1) {
    const row = matrix[index] || [];
    const sourceRow = index + 1;
    const invoiceNumber = String(get(row, 'invoice') ?? '').trim().replace(/\.0+$/, '');
    const quoteNumber = normalizeQuoteNumber(get(row, 'quote'));
    const purchaseOrder = normalizePurchaseOrder(get(row, 'purchaseOrder'));

    if (!invoiceNumber && !quoteNumber && !purchaseOrder) continue;
    if (!invoiceNumber || !quoteNumber || !purchaseOrder) {
      throw new Error(`Fila ${sourceRow}: factura, cotización y OC son obligatorias.`);
    }

    const issueDate = parseDateValue(get(row, 'issueDate'), 'Fecha emisión', sourceRow);
    const dueRaw = indexes.has('dueDate') ? get(row, 'dueDate') : null;
    const dueDate = String(dueRaw ?? '').trim()
      ? parseDateValue(dueRaw, 'Fecha vencimiento', sourceRow)
      : addDaysISO(issueDate, 30);
    const net = parseIntegerAmount(get(row, 'net'), 'Neto', sourceRow);
    const vat = parseIntegerAmount(get(row, 'vat'), 'IVA', sourceRow);
    const total = parseIntegerAmount(get(row, 'total'), 'Total', sourceRow);

    if (net + vat !== total) {
      throw new Error(`Fila ${sourceRow}: Neto + IVA no coincide con el Total.`);
    }

    parsed.push({
      id: `${invoiceNumber}:${sourceRow}`,
      sourceRow,
      quoteNumber,
      purchaseOrder,
      invoiceNumber,
      issueDate,
      dueDate,
      net,
      vat,
      total,
    });
  }

  if (parsed.length === 0) throw new Error('El archivo no contiene filas de facturación.');

  const duplicateInvoices = parsed
    .map((row) => row.invoiceNumber)
    .filter((invoice, index, values) => values.indexOf(invoice) !== index);
  if (duplicateInvoices.length > 0) {
    throw new Error(`Hay números de factura duplicados: ${[...new Set(duplicateInvoices)].join(', ')}.`);
  }

  return parsed;
};

export const parseBillingWorkbook = async (file: File): Promise<BillingImportRow[]> => {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new Error('El archivo no contiene hojas.');
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[firstSheetName], {
    header: 1,
    defval: '',
    raw: true,
  });
  return parseBillingRowsFromMatrix(matrix);
};

interface PartitionResult {
  row: BillingImportRow;
  services: Service[];
}

const findExactPartition = (
  rows: BillingImportRow[],
  services: Service[],
  amountForService: (service: Service) => number,
): PartitionResult[] | null => {
  const orderedRows = [...rows].sort((a, b) => b.net - a.net || a.sourceRow - b.sourceRow);
  const orderedServices = [...services].sort((a, b) =>
    amountForService(b) - amountForService(a) || a.folio.localeCompare(b.folio));
  let exploredStates = 0;
  const maxStates = 50_000;

  const subsetsForTarget = (available: Service[], target: number): Service[][] => {
    const matches: Service[][] = [];
    const visit = (position: number, remaining: number, selected: Service[]) => {
      exploredStates += 1;
      if (exploredStates > maxStates || matches.length >= 100) return;
      if (remaining === 0) {
        matches.push([...selected]);
        return;
      }
      if (remaining < 0 || position >= available.length) return;

      const service = available[position];
      const amount = amountForService(service);
      if (amount <= remaining) {
        selected.push(service);
        visit(position + 1, remaining - amount, selected);
        selected.pop();
      }
      visit(position + 1, remaining, selected);
    };
    visit(0, target, []);
    return matches.sort((a, b) => a.length - b.length ||
      a.map((service) => service.folio).join('|').localeCompare(b.map((service) => service.folio).join('|')));
  };

  const solve = (
    rowIndex: number,
    available: Service[],
    assignments: PartitionResult[],
  ): PartitionResult[] | null => {
    if (rowIndex === orderedRows.length) return available.length === 0 ? assignments : null;
    const row = orderedRows[rowIndex];

    if (rowIndex === orderedRows.length - 1) {
      const remainingTotal = available.reduce((sum, service) => sum + amountForService(service), 0);
      return remainingTotal === row.net
        ? [...assignments, { row, services: available }]
        : null;
    }

    for (const subset of subsetsForTarget(available, row.net)) {
      const selectedIds = new Set(subset.map((service) => service.id));
      const nextAvailable = available.filter((service) => !selectedIds.has(service.id));
      const result = solve(rowIndex + 1, nextAvailable, [...assignments, { row, services: subset }]);
      if (result) return result;
      if (exploredStates > maxStates) return null;
    }
    return null;
  };

  const solution = solve(0, orderedServices, []);
  if (!solution) return null;
  const byRowId = new Map(solution.map((item) => [item.row.id, item]));
  return rows.map((row) => byRowId.get(row.id)!).filter(Boolean);
};

const serviceHasBlockingInvoice = (service: Service): boolean =>
  service.status === 'invoiced'
  || service.status === 'partially_invoiced'
  || Boolean(service.invoiceFolio)
  || Boolean(service.invoiceNumeroFiscal);

export const reconcileBillingBatch = ({
  rows,
  services,
  clientId,
  allowPurchaseOrderOverwrite = false,
}: {
  rows: BillingImportRow[];
  services: Service[];
  clientId: string;
  allowPurchaseOrderOverwrite?: boolean;
}): BillingBatchPlan => {
  const rowsByQuote = new Map<string, BillingImportRow[]>();
  for (const row of rows) {
    const group = rowsByQuote.get(row.quoteNumber) || [];
    group.push(row);
    rowsByQuote.set(row.quoteNumber, group);
  }

  const groups: BillingQuoteGroup[] = [];
  for (const [quoteNumber, quoteRows] of rowsByQuote) {
    const quoteServices = services.filter((service) =>
      normalizeQuoteNumber(service.quoteNumber) === quoteNumber && service.status !== 'cancelled');
    const invoiceTotal = quoteRows.reduce((sum, row) => sum + row.net, 0);
    const serviceTotal = quoteServices.reduce(
      (sum, service) => sum + getDisplayServiceValue(service, clientId),
      0,
    );
    const difference = serviceTotal - invoiceTotal;

    if (quoteServices.length === 0) {
      groups.push({
        quoteNumber,
        invoiceTotal,
        serviceTotal,
        difference,
        status: 'unmatched',
        message: 'No hay servicios del cliente con esta cotización.',
        assignments: quoteRows.map((row) => ({ row, services: [], serviceTotal: 0, status: 'unmatched' })),
        services: [],
      });
      continue;
    }

    if (quoteServices.some(serviceHasBlockingInvoice)) {
      groups.push({
        quoteNumber,
        invoiceTotal,
        serviceTotal,
        difference,
        status: 'conflict',
        message: 'La cotización contiene servicios que ya están facturados o parcialmente facturados.',
        assignments: quoteRows.map((row) => ({ row, services: [], serviceTotal: 0, status: 'conflict' })),
        services: quoteServices,
      });
      continue;
    }

    if (difference !== 0) {
      groups.push({
        quoteNumber,
        invoiceTotal,
        serviceTotal,
        difference,
        status: 'mismatch',
        message: 'La suma de servicios no coincide con la suma neta de las facturas.',
        assignments: quoteRows.map((row) => ({ row, services: [], serviceTotal: 0, status: 'unmatched' })),
        services: quoteServices,
      });
      continue;
    }

    const partition = findExactPartition(
      quoteRows,
      quoteServices,
      (service) => getDisplayServiceValue(service, clientId),
    );
    if (!partition) {
      groups.push({
        quoteNumber,
        invoiceTotal,
        serviceTotal,
        difference,
        status: 'mismatch',
        message: 'El total cuadra, pero no existe una distribución exacta de servicios por factura.',
        assignments: quoteRows.map((row) => ({ row, services: [], serviceTotal: 0, status: 'unmatched' })),
        services: quoteServices,
      });
      continue;
    }

    const assignments: BillingInvoiceAssignment[] = partition.map(({ row, services: assignedServices }) => {
      const conflictingService = assignedServices.find((service) => {
        const existing = normalizePurchaseOrder(service.purchaseOrder || service.purchaseOrderNumber);
        return existing && existing !== row.purchaseOrder;
      });
      const serviceTotalForRow = assignedServices.reduce(
        (sum, service) => sum + getDisplayServiceValue(service, clientId),
        0,
      );
      if (conflictingService && !allowPurchaseOrderOverwrite) {
        return {
          row,
          services: assignedServices,
          serviceTotal: serviceTotalForRow,
          status: 'conflict',
          message: `${conflictingService.folio} ya tiene una OC diferente.`,
        };
      }
      return {
        row,
        services: assignedServices,
        serviceTotal: serviceTotalForRow,
        status: 'ready',
      };
    });
    const hasConflict = assignments.some((assignment) => assignment.status !== 'ready');
    groups.push({
      quoteNumber,
      invoiceTotal,
      serviceTotal,
      difference,
      status: hasConflict ? 'conflict' : 'ready',
      message: hasConflict ? 'Hay servicios con una OC distinta a la del archivo.' : undefined,
      assignments,
      services: quoteServices,
    });
  }

  const assignments = groups.flatMap((group) => group.assignments);
  const blockingCount = groups.filter((group) => group.status !== 'ready').length;
  return {
    groups,
    assignments,
    ready: groups.length > 0 && blockingCount === 0 && assignments.every((item) => item.status === 'ready'),
    invoiceCount: rows.length,
    serviceCount: new Set(assignments.flatMap((item) => item.services.map((service) => service.id))).size,
    netTotal: rows.reduce((sum, row) => sum + row.net, 0),
    blockingCount,
  };
};
