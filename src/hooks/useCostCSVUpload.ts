import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { useCostCategories } from '@/hooks/useCostCategories';
import { toast } from 'sonner';

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
    return date.toISOString().split('T')[0];
  }
  
  return null;
};

const parseAmount = (value: string): number | null => {
  if (!value) return null;
  const cleaned = value.toString().replace(/[$.\s]/g, '').replace(',', '.');
  const num = Number(cleaned);
  return isNaN(num) || num <= 0 ? null : num;
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
          const wb = XLSX.read(data, { type: 'binary' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(ws, { defval: '' });
          
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

    // Fetch existing costs for duplicate detection
    const { data: existingCosts } = await supabase
      .from('costs')
      .select('date, amount, description')
      .order('date', { ascending: false })
      .limit(5000);

    const existingSet = new Set<string>();
    existingCosts?.forEach(c => {
      existingSet.add(`${c.date}|${Number(c.amount)}|${c.description?.toLowerCase().trim()}`);
    });

    const validRows: CostRow[] = [];
    const invalidRows: CostRow[] = [];
    const globalWarnings: string[] = [];
    const seen = new Set<string>();

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
      const fechaPagoRaw = get(['fecha pago', 'fecha_pago', 'payment']);

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
      const pagado = ['si', 'sí', 'yes', '1', 'true', 'x'].includes(normalizeText(pagadoRaw));
      const fechaPago = pagado ? (parseDate(fechaPagoRaw) || fecha) : undefined;

      // Duplicate check
      if (fecha && monto && descripcion) {
        const key = `${fecha}|${monto}|${descripcion.toLowerCase()}`;
        if (seen.has(key)) {
          warnings.push('Posible duplicado en el archivo');
        }
        seen.add(key);
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

  const uploadCosts = useCallback(async (rows: CostRow[]): Promise<{ success: number; errors: number }> => {
    setIsUploading(true);
    setUploadProgress({ current: 0, total: rows.length });
    
    let success = 0;
    let errors = 0;
    const BATCH_SIZE = 50;

    try {
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        
        const insertData = batch.map(row => ({
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
          console.error('Batch insert error:', error);
          errors += batch.length;
        } else {
          success += batch.length;
        }

        setUploadProgress({ current: Math.min(i + BATCH_SIZE, rows.length), total: rows.length });
      }
    } finally {
      setIsUploading(false);
    }

    return { success, errors };
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
