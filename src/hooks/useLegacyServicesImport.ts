import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import {
  computeLegacyPreviewStats,
  parseLegacyServicesXLSX,
  type LegacyRow,
  type OverlapStats,
  type PreviewStats,
} from '@/utils/legacyServicesParser';

const logger = createLogger('LegacyServices');
const BATCH_SIZE = 200;
const OVERLAP_QUERY_CHUNK_SIZE = 500;

type ExistingOverlapRecord = {
  received_at: string;
  license_plate: string | null;
  manual_folio: string | null;
  expediente: string | null;
  import_id: string | null;
  legacy_service_imports?: { filename: string | null } | null;
};

const toDatabaseRow = (row: LegacyRow, importId: string) => {
  const {
    _rowIndex: _ignoredRowIndex,
    _invalidDate: _ignoredInvalidDate,
    _isTemplateExample: _ignoredTemplateExample,
    _normalizations: _ignoredNormalizations,
    _normalizationChangeCount: _ignoredNormalizationChangeCount,
    ...databaseRow
  } = row;
  return { ...databaseRow, received_at: row.received_at!, import_id: importId };
};

const tupleKey = (receivedAt: string, licensePlate: string | null | undefined) =>
  `${new Date(receivedAt).toISOString()}__${licensePlate ?? ''}`;

const fetchOverlapStats = async (rows: LegacyRow[]): Promise<OverlapStats> => {
  const validRows = rows.filter((row) => !row._invalidDate && row.received_at);
  if (!validRows.length) return { total_overlapping: 0, overlap_samples: [] };

  const incomingTuples = new Map<string, LegacyRow>();
  validRows.forEach((row) => {
    incomingTuples.set(tupleKey(row.received_at!, row.license_plate), row);
  });

  const incomingKeys = new Set(incomingTuples.keys());
  const overlappingKeys = new Set<string>();
  const samples: OverlapStats['overlap_samples'] = [];

  for (let start = 0; start < validRows.length; start += OVERLAP_QUERY_CHUNK_SIZE) {
    const chunk = validRows.slice(start, start + OVERLAP_QUERY_CHUNK_SIZE);
    const receivedAtValues = [...new Set(chunk.map((row) => row.received_at!).filter(Boolean))];
    if (!receivedAtValues.length) continue;

    const { data, error } = await supabase
      .from('legacy_services')
      .select('received_at, license_plate, manual_folio, expediente, import_id, legacy_service_imports(filename)')
      .in('received_at', receivedAtValues);

    if (error) throw new Error(`No fue posible revisar solapes con importaciones previas: ${error.message}`);

    const existingRows = (data ?? []) as unknown as ExistingOverlapRecord[];
    existingRows.forEach((existing) => {
      const key = tupleKey(existing.received_at, existing.license_plate);
      if (!incomingKeys.has(key)) return;
      overlappingKeys.add(key);
      if (samples.length >= 10) return;
      const incoming = incomingTuples.get(key);
      samples.push({
        received_at: existing.received_at,
        license_plate: existing.license_plate ?? '',
        manual_folio: incoming?.manual_folio || existing.manual_folio || '',
        existing_filename: existing.legacy_service_imports?.filename ?? 'Importación previa',
      });
    });
  }

  const totalOverlappingRows = validRows.filter((row) => overlappingKeys.has(tupleKey(row.received_at!, row.license_plate))).length;
  return {
    total_overlapping: totalOverlappingRows,
    overlap_samples: samples,
  };
};

export function useLegacyServicesImport() {
  const queryClient = useQueryClient();
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });

  const parseFile = async (file: File): Promise<{ rows: LegacyRow[]; stats: PreviewStats }> => {
    const rows = await parseLegacyServicesXLSX(file);
    const stats = computeLegacyPreviewStats(rows);
    stats.overlap_stats = await fetchOverlapStats(rows);
    return { rows, stats };
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
