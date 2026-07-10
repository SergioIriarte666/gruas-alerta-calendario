import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { computeRcvContentHash, type ParsedRcvRow } from '@/utils/siiRcvParser';
import type { SiiBookType } from '@/types/siiRcv';

const logger = createLogger('useSiiRcvImporter');
const BATCH_SIZE = 500;

export type SiiRcvImportParams = {
  entityRut: string;
  bookType: SiiBookType;
  fileName: string;
  period: string | null;
  rows: ParsedRcvRow[];
};

export type SiiRcvImportResult = {
  importId: string;
  inserted: number;
  skipped: number;
};

export function useSiiRcvImporter() {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const mutation = useMutation({
    mutationFn: async (params: SiiRcvImportParams): Promise<SiiRcvImportResult> => {
      const validRows = params.rows.filter((row) => !row._invalid);
      setProgress({ current: 0, total: validRows.length });

      const hashedRows = await Promise.all(validRows.map(async (row) => ({
        entity_rut: params.entityRut,
        book_type: params.bookType,
        doc_type: row.doc_type,
        folio: row.folio,
        counterpart_rut: row.counterpart_rut,
        counterpart_name: row.counterpart_name || null,
        doc_date: row.doc_date as string,
        net_amount: row.net_amount,
        exempt_amount: row.exempt_amount,
        tax_amount: row.tax_amount,
        total_amount: row.total_amount,
        content_hash: await computeRcvContentHash({
          entityRut: params.entityRut,
          bookType: params.bookType,
          docType: row.doc_type,
          folio: row.folio,
          counterpartRut: row.counterpart_rut,
          totalAmount: row.total_amount,
        }),
      })));

      const { data: authData } = await supabase.auth.getUser();
      const { data: importRecord, error: importError } = await supabase
        .from('sii_rcv_imports')
        .insert({
          entity_rut: params.entityRut,
          book_type: params.bookType,
          period: params.period,
          file_name: params.fileName,
          imported_by: authData.user?.id ?? null,
        })
        .select('id')
        .single();

      if (importError || !importRecord) {
        throw new Error(importError?.message || 'No fue posible crear el lote de importación.');
      }
      const importId = importRecord.id;

      let inserted = 0;
      for (let start = 0; start < hashedRows.length; start += BATCH_SIZE) {
        const batch = hashedRows.slice(start, start + BATCH_SIZE).map((row) => ({ ...row, import_id: importId }));
        const { data, error } = await supabase
          .from('sii_rcv_records')
          .upsert(batch, { onConflict: 'content_hash', ignoreDuplicates: true })
          .select('id');

        if (error) {
          logger.error('Error insertando lote sii_rcv_records', error);
          throw new Error(error.message);
        }
        inserted += data?.length ?? 0;
        setProgress({ current: Math.min(start + batch.length, hashedRows.length), total: hashedRows.length });
      }

      const skipped = params.rows.length - inserted;

      const { error: updateError } = await supabase
        .from('sii_rcv_imports')
        .update({ records_inserted: inserted, records_skipped: skipped })
        .eq('id', importId);
      if (updateError) logger.warn('No se pudo actualizar el resumen del lote', updateError);

      return { importId, inserted, skipped };
    },
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['sii-rcv'] }),
        queryClient.invalidateQueries({ queryKey: ['sii-rcv-imports'] }),
        queryClient.invalidateQueries({ queryKey: ['sii-resultado'] }),
      ]);
      toast.success(`Importación finalizada: ${result.inserted} insertados, ${result.skipped} duplicados omitidos.`);
    },
    onError: (error: Error) => {
      logger.error('Error en importación RCV', error);
      toast.error(error.message || 'No fue posible completar la importación.');
    },
  });

  return { ...mutation, progress };
}
