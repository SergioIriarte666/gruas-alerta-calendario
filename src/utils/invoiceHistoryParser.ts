import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Client } from '@/types';
import { toTitleCase } from '@/lib/utils';

export interface ParsedInvoiceRow {
  item: string;
  emitido: string;
  documento: string;
  folio: string;
  fecha: string;
  rut: string;
  codigoCliente: string;
  razonSocial: string;
  direccionCliente: string;
  formaPago: string;
  neto: number;
  iva: number;
  tasaIva: number;
  total: number;
  observacion: string;
  pagado: string;
  fechaCreacion: string;
  fechaVencimiento: string;
  correo: string;
}

export interface ProcessedInvoice {
  folio: string;
  numeroFiscal: string;
  rut: string;
  razonSocial: string;
  issueDate: string;
  dueDate: string;
  subtotal: number;
  iva: number;
  total: number;
  status: 'paid' | 'sent' | 'overdue';
  isPaid: boolean;
  notes: string;
  clientId?: string;
  clientMatch?: 'exact' | 'multiple' | 'none';
  matchedClients?: Client[];
}

export interface UnmatchedClient {
  rut: string;
  razonSocial: string;
  address?: string;
  email?: string;
  invoiceCount: number;
  totalAmount: number;
  resolution: 'create' | 'assign' | 'ignore' | 'pending';
  assignedClientId?: string;
  suggestion?: {
    clientId: string;
    name: string;
    score: number;
  };
}

export interface ImportPreview {
  matched: ProcessedInvoice[];
  unmatched: ProcessedInvoice[];
  duplicates: ProcessedInvoice[];
  unmatchedClients: UnmatchedClient[];
  totalInvoices: number;
  totalAmount: number;
  skippedNonFactura: number;
}

// Normalize RUT for comparison (remove dots, keep dash)
const normalizeRut = (rut: string): string => {
  return rut.replace(/[^0-9Kk]/g, '').trim().toUpperCase();
};

// Parse date from various formats to YYYY-MM-DD
const parseDate = (dateVal: any): string | null => {
  if (!dateVal) return null;

  // Handle Excel serial numbers
  if (typeof dateVal === 'number') {
    // Excel base date is 1899-12-30. JS is 1970-01-01.
    // Difference is 25569 days.
    const date = new Date((dateVal - 25569) * 86400 * 1000);
    // Adjust for timezone offset to avoid previous day due to UTC
    date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
    if (!isNaN(date.getTime())) {
       return date.toISOString().split('T')[0];
    }
  }

  const dateStr = String(dateVal).trim();
  
  // Try ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

  // Try DD-MM-YYYY or DD/MM/YYYY
  const parts = dateStr.split(/[-/]/);
  if (parts.length === 3) {
    let day, month, year;
    
    // Check for DD-MM-YYYY or DD/MM/YYYY
    if (parts[0].length <= 2 && parts[2].length === 4) {
       [day, month, year] = parts;
    } 
    // Check for YYYY-MM-DD or YYYY/MM/DD
    else if (parts[0].length === 4 && parts[2].length <= 2) {
       [year, month, day] = parts;
    } else {
       return null;
    }
    
    // Ensure padding
    const y = year;
    const m = month.padStart(2, '0');
    const d = day.padStart(2, '0');
    
    const date = new Date(`${y}-${m}-${d}`);
    if (!isNaN(date.getTime())) {
       return `${y}-${m}-${d}`;
    }
  }
  
  return null;
};

// Determine invoice status
const determineStatus = (pagado: string, fechaVencimiento: any): 'paid' | 'sent' | 'overdue' => {
  if (pagado?.toUpperCase() === 'SI') return 'paid';
  
  if (fechaVencimiento) {
    const dueDateStr = parseDate(fechaVencimiento);
    if (dueDateStr) {
      const due = new Date(dueDateStr);
      // Fix timezone issue for comparison
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      due.setHours(0, 0, 0, 0);
      // Add a small buffer for timezone differences if needed, or just compare
      // Assuming dates are local
      const dueTime = due.getTime() + (due.getTimezoneOffset() * 60000);
      const todayTime = today.getTime();
      
      if (dueTime < todayTime) return 'overdue';
    }
  }
  return 'sent';
};

// Parse number from string (handles Chilean format)
const parseNumber = (value: any): number => {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const cleaned = String(value).replace(/\./g, '').replace(',', '.').trim();
  const num = Number(cleaned);
  return isNaN(num) ? 0 : num;
};

// Parse CSV file
export const parseCSVFile = (file: File): Promise<ParsedInvoiceRow[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      delimiter: ';',
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const rows = result.data as Record<string, any>[];
        
        // Helper to find column by multiple possible names
        const findVal = (row: any, keys: string[]) => {
          for (const key of keys) {
            const foundKey = Object.keys(row).find(k => k.trim().toLowerCase() === key.toLowerCase());
            if (foundKey) return row[foundKey];
          }
          return '';
        };

        const dataRows = rows.map(row => ({
          item: findVal(row, ['Item', 'N°', 'No', '#']),
          emitido: findVal(row, ['Emitido', 'Emision', 'Fecha Emision']),
          documento: findVal(row, ['Documento', 'Tipo DTE', 'Tipo Documento']),
          folio: findVal(row, ['Folio', 'Numero', 'N° Folio']),
          fecha: findVal(row, ['Fecha', 'Fecha Emision', 'F. Emis']),
          rut: findVal(row, ['RUT', 'R.U.T.', 'Rut Cliente']),
          codigoCliente: findVal(row, ['Codigo', 'Cod. Cliente']),
          razonSocial: findVal(row, ['Razon Social', 'Cliente', 'Nombre']),
          direccionCliente: findVal(row, ['Direccion', 'Domicilio']),
          formaPago: findVal(row, ['Forma Pago', 'F. Pago']),
          neto: parseNumber(findVal(row, ['Neto', 'Monto Neto'])),
          iva: parseNumber(findVal(row, ['IVA', 'Monto IVA'])),
          tasaIva: parseNumber(findVal(row, ['Tasa IVA', '% IVA'])),
          total: parseNumber(findVal(row, ['Total', 'Monto Total'])),
          observacion: findVal(row, ['Observacion', 'Glosa', 'Nota']),
          pagado: findVal(row, ['Pagado', 'Estado Pago']),
          fechaCreacion: findVal(row, ['Fecha Creacion', 'Creado']),
          fechaVencimiento: findVal(row, ['Fecha Vencimiento', 'Vencimiento', 'F. Venc']),
          correo: findVal(row, ['Correo', 'Email', 'Email Cliente']),
        }));
        resolve(dataRows);
      },
      error: (error) => reject(error),
    });
  });
};

// Parse XLSX file
export const parseXLSXFile = (file: File): Promise<ParsedInvoiceRow[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<any>(firstSheet); // header: 1 removed to get objects
        
        // Helper to find column by multiple possible names
        const findVal = (row: any, keys: string[]) => {
          for (const key of keys) {
            // Check exact match first
            if (row[key] !== undefined) return row[key];
            // Check case insensitive
            const foundKey = Object.keys(row).find(k => k.trim().toLowerCase() === key.toLowerCase());
            if (foundKey) return row[foundKey];
          }
          return '';
        };
        
        const dataRows = rows.map(row => ({
          item: String(findVal(row, ['Item', 'N°', 'No', '#']) || ''),
          emitido: String(findVal(row, ['Emitido', 'Emision']) || ''),
          documento: String(findVal(row, ['Documento', 'Tipo DTE', 'Tipo Documento']) || ''),
          folio: String(findVal(row, ['Folio', 'Numero', 'N° Folio']) || ''),
          fecha: String(findVal(row, ['Fecha', 'Fecha Emision', 'F. Emis']) || ''),
          rut: String(findVal(row, ['RUT', 'R.U.T.', 'Rut Cliente']) || ''),
          codigoCliente: String(findVal(row, ['Codigo', 'Cod. Cliente']) || ''),
          razonSocial: String(findVal(row, ['Razon Social', 'Cliente', 'Nombre']) || ''),
          direccionCliente: String(findVal(row, ['Direccion', 'Domicilio']) || ''),
          formaPago: String(findVal(row, ['Forma Pago', 'F. Pago']) || ''),
          neto: parseNumber(findVal(row, ['Neto', 'Monto Neto'])),
          iva: parseNumber(findVal(row, ['IVA', 'Monto IVA'])),
          tasaIva: parseNumber(findVal(row, ['Tasa IVA', '% IVA'])),
          total: parseNumber(findVal(row, ['Total', 'Monto Total'])),
          observacion: String(findVal(row, ['Observacion', 'Glosa', 'Nota']) || ''),
          pagado: String(findVal(row, ['Pagado', 'Estado Pago']) || ''),
          fechaCreacion: String(findVal(row, ['Fecha Creacion', 'Creado']) || ''),
          fechaVencimiento: String(findVal(row, ['Fecha Vencimiento', 'Vencimiento', 'F. Venc']) || ''),
          correo: String(findVal(row, ['Correo', 'Email', 'Email Cliente']) || ''),
        }));
        resolve(dataRows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

// Process parsed rows against existing clients and invoices
export const processInvoiceRows = (
  rows: ParsedInvoiceRow[],
  clients: Client[],
  existingNumerosFiscales: Set<string>
): ImportPreview => {
  // Filter only FACTURA ELECTRONICA
  const facturas = rows.filter(r => r.documento?.toUpperCase().includes('FACTURA ELECTRONICA'));
  const skippedNonFactura = rows.length - facturas.length;

  const matched: ProcessedInvoice[] = [];
  const unmatched: ProcessedInvoice[] = [];
  const duplicates: ProcessedInvoice[] = [];
  const unmatchedClientsMap = new Map<string, UnmatchedClient>();

  for (const row of facturas) {
    const normalizedRut = normalizeRut(row.rut);
    const issueDate = parseDate(row.fecha) || '';
    const dueDate = parseDate(row.fechaVencimiento) || issueDate;
    const status = determineStatus(row.pagado, row.fechaVencimiento);

    const processed: ProcessedInvoice = {
      folio: `HIST-${row.folio}`,
      numeroFiscal: row.folio,
      rut: row.rut,
      razonSocial: toTitleCase(row.razonSocial),
      issueDate,
      dueDate,
      subtotal: row.neto,
      iva: row.iva,
      total: row.total,
      status,
      isPaid: row.pagado?.toUpperCase() === 'SI',
      notes: `Importación historial 2025 — ${row.observacion || ''}`.trim(),
    };

    // Check duplicates by numero_fiscal
    if (existingNumerosFiscales.has(row.folio)) {
      duplicates.push(processed);
      continue;
    }

    // Match client by RUT
    const matchingClients = clients.filter(c => normalizeRut(c.rut) === normalizedRut);

    if (matchingClients.length >= 1) {
      // RUT is the primary key for matching, even when multiple departments exist
      processed.clientId = matchingClients[0].id;
      processed.clientMatch = matchingClients.length > 1 ? 'multiple' : 'exact';
      if (matchingClients.length > 1) {
        processed.matchedClients = matchingClients;
      }
      matched.push(processed);
    } else {
      processed.clientMatch = 'none';
      unmatched.push(processed);
      if (!unmatchedClientsMap.has(normalizedRut)) {
        unmatchedClientsMap.set(normalizedRut, {
          rut: row.rut,
          razonSocial: toTitleCase(row.razonSocial),
          address: toTitleCase(row.direccionCliente || ''),
          email: row.correo || '',
          invoiceCount: 0,
          totalAmount: 0,
          resolution: 'pending',
        });
      }
      const uc = unmatchedClientsMap.get(normalizedRut)!;
      uc.invoiceCount++;
      uc.totalAmount += row.total;
    }
  }

  return {
    matched,
    unmatched,
    duplicates,
    unmatchedClients: Array.from(unmatchedClientsMap.values()),
    totalInvoices: facturas.length,
    totalAmount: facturas.reduce((sum, r) => sum + r.total, 0),
    skippedNonFactura,
  };
};
