import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { computeRcvContentHash, type ParsedRcvRow } from '@/utils/siiRcvParser';
import { normalizeRut } from '@/utils/rutFormatter';
import { resolveRazonSocialesForRuts } from './rutResolver';
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

      // El RUT de contraparte ya viene normalizado desde el parser; normalizamos
      // también el de la entidad para que el content_hash siempre se calcule sobre
      // RUT en formato estándar XX.XXX.XXX-D (dedupe estable e independiente del formato).
      const entityRut = normalizeRut(params.entityRut);

      // Resolver razón social faltante (el CSV por-tipo del SII de compras no la trae).
      // Un solo lookup por RUT aunque haya varias facturas del mismo proveedor; el
      // content_hash NO incluye counterpart_name, así que esto no afecta la dedupe.
      const rutsSinNombre = validRows
        .filter((row) => !row.counterpart_name || row.counterpart_name.trim() === '')
        .map((row) => row.counterpart_rut);
      const resolvedNames = rutsSinNombre.length > 0
        ? await resolveRazonSocialesForRuts(rutsSinNombre)
        : new Map<string, string>();

      const hashedRows = await Promise.all(validRows.map(async (row) => ({
        entity_rut: entityRut,
        book_type: params.bookType,
        doc_type: row.doc_type,
        folio: row.folio,
        counterpart_rut: row.counterpart_rut,
        counterpart_name: (row.counterpart_name && row.counterpart_name.trim())
          || resolvedNames.get(normalizeRut(row.counterpart_rut))
          || null,
        doc_date: row.doc_date as string,
        net_amount: row.net_amount,
        exempt_amount: row.exempt_amount,
        tax_amount: row.tax_amount,
        total_amount: row.total_amount,
        content_hash: await computeRcvContentHash({
          entityRut,
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
          entity_rut: entityRut,
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

      // Auto-vinculación conciliatoria con costs (no bloqueante): busca por (dte_tipo, dte_folio,
      // dte_rut_emisor) — misma identidad de documento que el wizard "Cargar Gastos desde XML" deja
      // en costs. Solo aplica a compras: linked_cost_id está restringido a book_type='compra'.
      if (params.bookType === 'compra' && validRows.length > 0) {
        try {
          const emisorRuts = Array.from(new Set(validRows.map((row) => row.counterpart_rut).filter(Boolean)));
          const { data: candidateCosts, error: candidatesError } = await supabase
            .from('costs')
            .select('id, dte_tipo, dte_folio, dte_rut_emisor')
            .in('dte_rut_emisor', emisorRuts)
            .not('dte_folio', 'is', null);

          if (!candidatesError && candidateCosts) {
            const costIdByKey = new Map<string, string>();
            candidateCosts.forEach((c) => {
              if (c.dte_tipo == null || c.dte_folio == null || !c.dte_rut_emisor) return;
              costIdByKey.set(`${c.dte_tipo}|${c.dte_folio}|${c.dte_rut_emisor}`, c.id);
            });

            const linkUpdates = hashedRows
              .map((row) => ({ contentHash: row.content_hash, costId: costIdByKey.get(`${row.doc_type}|${row.folio}|${row.counterpart_rut}`) }))
              .filter((r): r is { contentHash: string; costId: string } => !!r.costId);

            await Promise.all(linkUpdates.map(({ contentHash, costId }) =>
              supabase.from('sii_rcv_records')
                .update({ linked_cost_id: costId })
                .eq('content_hash', contentHash)
                .is('linked_cost_id', null)
            ));
          }
        } catch (linkError) {
          logger.warn('Auto-vinculación con costs falló (no bloqueante)', linkError);
        }
      }

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
