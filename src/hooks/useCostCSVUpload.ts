import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { useCostCategories } from '@/hooks/useCostCategories';
import { toast } from 'sonner';

import { toLocalDateString } from '@/utils/timezoneUtils';
import { createLogger } from "@/lib/logger";


const logger = createLogger("useCostCSVUpload");
interface CostRow {
  rowIndex: number;
  fecha: string;
  descripcion: string;
  monto: number;
  categoria: string;
  subcategoria?: string;
  notas?: string;
  pagado: boolean;
  fechaPago?: string;
  categoryId?: string;
  existingCostId?: string;
  existingPaymentDate?: string | null;
  errors: string[];
  warnings: string[];
}

export interface CostCSVValidationResult {
  totalRows: number;
  validRows: CostRow[];
  invalidRows: CostRow[];
  warnings: string[];
}

const normalizeText = (text: string) =>
  text?.toString().trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') || '';

const normalizeDescription = (text: string) =>
  normalizeText(text).replace(/\s+/g, ' ').trim();

const parseDate = (value: string): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  
  // Try yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  
  // Try dd/mm/yyyy or dd-mm-yyyy
  const match = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) {
    const [, d, m, y] = match;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  
  // Try Excel serial number
  const num = Number(trimmed);
  if (!isNaN(num) && num > 40000 && num < 60000) {
    const date = new Date((num - 25569) * 86400 * 1000);
    return toLocalDateString(date);
  }
  
  return null;
};

const parseAmount = (value: string): number | null => {
  if (!value) return null;
  const cleaned = value.toString().replace(/[$.\s]/g, '').replace(',', '.');
  const num = Number(cleaned);
  return isNaN(num) || num <= 0 ? null : num;
};

const parsePaidFlag = (value: string): boolean => {
  const v = normalizeText(value);
  if (!v) return false;
  if (['1', 'true', 'x', 'y', 'yes', 'paid', 'pagado', 'p'].includes(v)) return true;
  if (v === 'si' || v === 's') return true;
  if (v.startsWith('si ')) return true;
  if (v.startsWith('pag')) return true;
  return false;
};

export const useCostCSVUpload = () => {
  const { data: categories = [] } = useCostCategories();
  const [file, setFile] = useState<File | null>(null);
  const [rawData, setRawData] = useState<any[]>([]);
  const [validationResult, setValidationResult] = useState<CostCSVValidationResult | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });

  const parseFile = useCallback(async (selectedFile: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const wb = XLSX.read(data, { type: 'binary', cellDates: true });
          const ws = wb.Sheets[wb.SheetNames[0]];
          // raw:true so Date cells stay as Date — we convert via UTC components
          // below to avoid local-timezone off-by-one issues.
          const rawJson = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '', raw: true });
          const jsonData = rawJson.map((row) => {
            const out: Record<string, any> = {};
            for (const [k, v] of Object.entries(row)) {
              if (v instanceof Date) {
                const y = v.getUTCFullYear();
                const m = String(v.getUTCMonth() + 1).padStart(2, '0');
                const d = String(v.getUTCDate()).padStart(2, '0');
                out[k] = `${y}-${m}-${d}`;
              } else {
                out[k] = v;
              }
            }
            return out;
          });
          
          // Filter out empty rows
          const filtered = jsonData.filter((row: any) => {
            const values = Object.values(row);
            return values.some(v => v !== '' && v !== null && v !== undefined);
          });
          
          setRawData(filtered);
          resolve(filtered);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Error leyendo archivo'));
      reader.readAsBinaryString(selectedFile);
    });
  }, []);

  const validate = useCallback(async (data: any[]): Promise<CostCSVValidationResult> => {
    const categoryMap = new Map<string, string>();
    categories.forEach(c => {
      if (c.name) categoryMap.set(normalizeText(c.name), c.id);
    });

    const globalWarnings: string[] = [];
    const validRows: CostRow[] = [];
    const invalidRows: CostRow[] = [];
    const seen = new Set<string>();

    const getRowValue = (row: any, names: string[]) => {
      const keys = Object.keys(row);
      const key = keys.find(k => names.some(n => normalizeText(k).includes(normalizeText(n))));
      return key ? String(row[key] ?? '') : '';
    };

    const parsedDates = data
      .map((row) => parseDate(getRowValue(row, ['fecha'])))
      .filter((d): d is string => !!d)
      .sort();

    const dateFrom = parsedDates[0];
    const dateTo = parsedDates[parsedDates.length - 1];

    const existingSet = new Set<string>();
    const existingByKey = new Map<string, { id: string; payment_date: string | null }>();
    if (dateFrom && dateTo) {
      const { data: existingCosts, error } = await supabase
        .from('costs')
        .select('id, date, amount, description, payment_date')
        .gte('date', dateFrom)
        .lte('date', dateTo);

      if (error) {
        toast.error('No se pudo validar duplicados contra la base de datos');
        globalWarnings.push('No se pudo validar duplicados contra la base de datos');
      } else {
        existingCosts?.forEach((c) => {
          const k = `${c.date}|${Number(c.amount)}|${normalizeDescription(c.description || '')}`;
          existingSet.add(k);
          existingByKey.set(k, { id: c.id, payment_date: c.payment_date ?? null });
        });
      }
    }

    data.forEach((row, index) => {
      const errors: string[] = [];
      const warnings: string[] = [];
      
      // Get values by column name (flexible matching)
      const keys = Object.keys(row);
      const get = (names: string[]) => {
        const key = keys.find(k => names.some(n => normalizeText(k).includes(normalizeText(n))));
        return key ? String(row[key] ?? '') : '';
      };

      const fechaRaw = get(['fecha']);
      const descripcion = get(['descripcion', 'description']).trim();
      const montoRaw = get(['monto', 'amount', 'valor']);
      const categoriaRaw = get(['categoria', 'category']);
      const subcategoria = get(['subcategoria', 'subcategory']).trim() || undefined;
      const notas = get(['notas', 'notes', 'observaciones']).trim() || undefined;
      const pagadoRaw = get(['pagado', 'paid']);
      const fechaPagoRaw = get(['fecha pago', 'fecha de pago', 'fecha_pago', 'fechapago', 'payment date', 'paid date']);

      // Validate fecha
      const fecha = parseDate(fechaRaw);
      if (!fecha) errors.push(`Fecha inválida: "${fechaRaw}"`);

      // Validate descripcion
      if (!descripcion) errors.push('Descripción vacía');

      // Validate monto
      const monto = parseAmount(montoRaw);
      if (monto === null) errors.push(`Monto inválido: "${montoRaw}"`);

      // Validate categoria
      const catNorm = normalizeText(categoriaRaw);
      const categoryId = categoryMap.get(catNorm);
      if (!categoriaRaw.trim()) {
        errors.push('Categoría vacía');
      } else if (!categoryId) {
        errors.push(`Categoría no encontrada: "${categoriaRaw.trim()}"`);
      }

      // Parse pagado
      const parsedFechaPago = parseDate(fechaPagoRaw);
      const pagado = parsePaidFlag(pagadoRaw) || !!parsedFechaPago;
      const fechaPago = pagado ? (parsedFechaPago || fecha) : undefined;

      // Duplicate check - within file
      if (fecha && monto !== null && descripcion) {
        const key = `${fecha}|${monto}|${normalizeDescription(descripcion)}`;
        if (seen.has(key)) {
          errors.push('Duplicado en el archivo (misma fecha, monto y descripción)');
        }
        seen.add(key);

        // Duplicate check - against database
        if (existingSet.has(key)) {
          const existing = existingByKey.get(key);
          if (existing) {
            if (pagado && !existing.payment_date) {
              warnings.push('Existe en base de datos (se actualizará a pagado)');
            } else {
              warnings.push('Existe en base de datos (se omitirá)');
            }
          } else {
            warnings.push('Existe en base de datos (se omitirá)');
          }
        }
      }

      const costRow: CostRow = {
        rowIndex: index + 2, // +2 for header + 0-index
        fecha: fecha || '',
        descripcion,
        monto: monto || 0,
        categoria: categoriaRaw.trim(),
        subcategoria,
        notas,
        pagado,
        fechaPago,
        categoryId,
        existingCostId: (() => {
          if (!fecha || monto === null || !descripcion) return undefined;
          const key = `${fecha}|${monto}|${normalizeDescription(descripcion)}`;
          return existingByKey.get(key)?.id;
        })(),
        existingPaymentDate: (() => {
          if (!fecha || monto === null || !descripcion) return undefined;
          const key = `${fecha}|${monto}|${normalizeDescription(descripcion)}`;
          return existingByKey.get(key)?.payment_date ?? undefined;
        })(),
        errors,
        warnings,
      };

      if (errors.length > 0) {
        invalidRows.push(costRow);
      } else {
        validRows.push(costRow);
      }
    });

    const result: CostCSVValidationResult = {
      totalRows: data.length,
      validRows,
      invalidRows,
      warnings: globalWarnings,
    };
    
    setValidationResult(result);
    return result;
  }, [categories]);

  const uploadCosts = useCallback(async (rows: CostRow[]): Promise<{ created: number; updated: number; skipped: number; errors: number }> => {
    setIsUploading(true);
    setUploadProgress({ current: 0, total: rows.length });
    
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    const BATCH_SIZE = 50;

    try {
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);

        const toInsert = batch.filter((r) => !r.existingCostId);
        const toUpdate = batch.filter((r) => !!r.existingCostId && r.pagado && !r.existingPaymentDate);
        const toSkip = batch.filter((r) => !!r.existingCostId && (!r.pagado || !!r.existingPaymentDate));

        if (toInsert.length > 0) {
          const insertData = toInsert.map((row) => ({
            date: row.fecha,
            description: row.descripcion,
            amount: row.monto,
            category_id: row.categoryId!,
            subcategory: row.subcategoria || null,
            notes: row.notas || null,
            payment_date: row.pagado ? (row.fechaPago || row.fecha) : null,
          }));

          const { error } = await supabase.from('costs').insert(insertData);
          if (error) {
            logger.error('Batch insert error:', error);
            errors += toInsert.length;
          } else {
            created += toInsert.length;
          }
        }

        if (toUpdate.length > 0) {
          const updates = await Promise.all(
            toUpdate.map((row) =>
              supabase
                .from('costs')
                .update({ payment_date: row.fechaPago || row.fecha })
                .eq('id', row.existingCostId!)
                .is('payment_date', null)
            )
          );

          const updateErrors = updates.filter((r) => r.error);
          if (updateErrors.length > 0) {
            logger.error('Batch update payment_date error:', updateErrors);
            errors += updateErrors.length;
          }

          updated += toUpdate.length - updateErrors.length;
        }

        skipped += toSkip.length;

        setUploadProgress({ current: Math.min(i + BATCH_SIZE, rows.length), total: rows.length });
      }
    } finally {
      setIsUploading(false);
    }

    return { created, updated, skipped, errors };
  }, []);

  const reset = useCallback(() => {
    setFile(null);
    setRawData([]);
    setValidationResult(null);
    setUploadProgress({ current: 0, total: 0 });
  }, []);

  return {
    file,
    setFile,
    rawData,
    validationResult,
    isUploading,
    uploadProgress,
    parseFile,
    validate,
    uploadCosts,
    reset,
    categories,
  };
};
