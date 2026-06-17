import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ImportType } from '@/hooks/useImportMappings';
import { createLogger } from "@/lib/logger";

const logger = createLogger("useImportHistoryLog");

export type ImportHistoryStatus = 'success' | 'partial' | 'failed';

export interface ImportHistoryLogEntry {
  id: string;
  organization_id: string;
  import_type: ImportType;
  file_name: string;
  imported_count: number;
  error_count: number;
  skipped_count: number;
  date_range_start: string | null;
  date_range_end: string | null;
  status: ImportHistoryStatus | null;
  created_at: string;
}

export interface SaveImportHistoryLogInput {
  importType: ImportType;
  fileName: string;
  importedCount: number;
  errorCount: number;
  skippedCount: number;
  dateRangeStart?: string | null;
  dateRangeEnd?: string | null;
  status: ImportHistoryStatus;
}

const mapImportHistoryLog = (row: any): ImportHistoryLogEntry => ({
  id: row.id,
  organization_id: row.organization_id,
  import_type: row.import_type,
  file_name: row.file_name,
  imported_count: row.imported_count ?? 0,
  error_count: row.error_count ?? 0,
  skipped_count: row.skipped_count ?? 0,
  date_range_start: row.date_range_start ?? null,
  date_range_end: row.date_range_end ?? null,
  status: row.status ?? null,
  created_at: row.created_at,
});

const fetchImportLogs = async (
  importType: ImportType,
  limit = 5
): Promise<ImportHistoryLogEntry[]> => {
  const { data, error } = await supabase
    .from('import_history_log')
    .select('*')
    .eq('import_type', importType)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error('[useImportHistoryLog] Error cargando historial de importaciones:', error);
    throw error;
  }
  return (data ?? []).map(mapImportHistoryLog);
};

export const useImportHistoryLog = (importType?: ImportType, limit = 5) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['import-history-log', importType, limit],
    queryFn: () => fetchImportLogs(importType as ImportType, limit),
    enabled: Boolean(importType),
    staleTime: 60_000,
  });

  const getLogs = useCallback(
    async (requestedImportType: ImportType, requestedLimit = 5) =>
      queryClient.fetchQuery({
        queryKey: ['import-history-log', requestedImportType, requestedLimit],
        queryFn: () => fetchImportLogs(requestedImportType, requestedLimit),
        staleTime: 60_000,
      }),
    [queryClient]
  );

  const getOverlappingLogs = useCallback(
    async (requestedImportType: ImportType, startDate: string, endDate: string) => {
      if (!startDate || !endDate) return [];

      const { data, error } = await supabase
        .from('import_history_log')
        .select('*')
        .eq('import_type', requestedImportType)
        .not('date_range_start', 'is', null)
        .not('date_range_end', 'is', null)
        .lte('date_range_start', endDate)
        .gte('date_range_end', startDate)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('[useImportHistoryLog] Error buscando logs solapados:', error);
        throw error;
      }
      return (data ?? []).map(mapImportHistoryLog);
    },
    []
  );

  const saveLog = useCallback(
    async (input: SaveImportHistoryLogInput) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.id) {
        logger.error('[useImportHistoryLog] Usuario no autenticado al guardar log');
        throw new Error('No se pudo obtener el usuario actual para guardar el log.');
      }

      const { data, error } = await supabase
        .from('import_history_log')
        .insert({
          organization_id: user.id,
          import_type: input.importType,
          file_name: input.fileName,
          imported_count: input.importedCount,
          error_count: input.errorCount,
          skipped_count: input.skippedCount,
          date_range_start: input.dateRangeStart ?? null,
          date_range_end: input.dateRangeEnd ?? null,
          status: input.status,
        })
        .select('*')
        .single();

      if (error) {
        logger.error('[useImportHistoryLog] Error guardando log de importación:', error);
        throw error;
      }

      await queryClient.invalidateQueries({
        queryKey: ['import-history-log', input.importType],
      });

      return mapImportHistoryLog(data);
    },
    [queryClient]
  );

  return {
    logs: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    getLogs,
    getOverlappingLogs,
    saveLog,
  };
};
