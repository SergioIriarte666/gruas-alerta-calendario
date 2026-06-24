import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import {
  computeLegacyPreviewStats,
  parseLegacyServicesXLSX,
  type LegacyRow,
  type PreviewStats,
} from '@/utils/legacyServicesParser';

const logger = createLogger('LegacyServices');
const BATCH_SIZE = 200;

const toDatabaseRow = (row: LegacyRow, importId: string) => {
  const { _rowIndex: _ignoredRowIndex, _invalidDate: _ignoredInvalidDate, ...databaseRow } = row;
  return { ...databaseRow, received_at: row.received_at!, import_id: importId };
};

export function useLegacyServicesImport() {
  const queryClient = useQueryClient();
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });

  const parseFile = async (file: File): Promise<{ rows: LegacyRow[]; stats: PreviewStats }> => {
    const rows = await parseLegacyServicesXLSX(file);
    return { rows, stats: computeLegacyPreviewStats(rows) };
  };

  const runImport = async (
    filename: string,
    rows: LegacyRow[],
    notes?: string,
  ): Promise<{ importId: string; inserted: number; skipped: number; errors: string[] }> => {
    const stats = computeLegacyPreviewStats(rows);
    const { data: authData } = await supabase.auth.getUser();
    const { data: importRecord, error: importError } = await supabase
      .from('legacy_service_imports')
      .insert({
        filename,
        total_rows: rows.length,
        period_from: stats.period_from,
        period_to: stats.period_to,
        notes: notes?.trim() || null,
        created_by: authData.user?.id ?? null,
      })
      .select('id')
      .single();

    if (importError || !importRecord) {
      throw new Error(importError?.message || 'No fue posible crear el lote de importación.');
    }

    const importId = importRecord.id;
    const validRows = rows.filter((row) => !row._invalidDate && row.received_at);
    setImportProgress({ current: 0, total: validRows.length });
    let inserted = 0;
    let skipped = rows.length - validRows.length;
    const errors: string[] = [];

    for (let start = 0; start < validRows.length; start += BATCH_SIZE) {
      const batchRows = validRows.slice(start, start + BATCH_SIZE);
      const payload = batchRows.map((row) => toDatabaseRow(row, importId));
      const { error: batchError } = await supabase.from('legacy_services').insert(payload);

      if (!batchError) {
        inserted += payload.length;
        setImportProgress({ current: Math.min(start + batchRows.length, validRows.length), total: validRows.length });
        continue;
      }

      logger.warn(`Falló lote desde fila ${batchRows[0]?._rowIndex}; reintentando individualmente`, batchError);
      for (const row of batchRows) {
        const { error: rowError } = await supabase.from('legacy_services').insert(toDatabaseRow(row, importId));
        if (!rowError) {
          inserted += 1;
        } else {
          skipped += 1;
          if (rowError.code !== '23505') {
            errors.push(`Fila ${row._rowIndex}: ${rowError.message}`);
          }
        }
      }
      setImportProgress({ current: Math.min(start + batchRows.length, validRows.length), total: validRows.length });
    }

    const { error: updateError } = await supabase
      .from('legacy_service_imports')
      .update({ inserted_rows: inserted, skipped_rows: skipped })
      .eq('id', importId);
    if (updateError) errors.push(`No se pudo actualizar el resumen del lote: ${updateError.message}`);

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['legacy-services-list'] }),
      queryClient.invalidateQueries({ queryKey: ['legacy-services-analytics'] }),
      queryClient.invalidateQueries({ queryKey: ['legacy-imports-list'] }),
      queryClient.invalidateQueries({ queryKey: ['legacy-filter-options'] }),
    ]);
    toast.success(`Importación finalizada: ${inserted} servicios ingresados, ${skipped} omitidos.`);
    return { importId, inserted, skipped, errors };
  };

  return { parseFile, runImport, importProgress };
}
