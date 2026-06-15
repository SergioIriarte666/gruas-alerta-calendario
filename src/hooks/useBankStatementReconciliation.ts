import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import {
  isSupportedBankStatementFile,
  parseBankStatementFile,
} from '@/utils/bankStatementParser';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { createLogger } from '@/lib/logger';

const logger = createLogger('useBankStatementReconciliation');

export type BankStatementImport = Tables<'bank_statement_imports'>;
export type BankStatementMovement = Tables<'bank_statement_movements'>;

export interface BankStatementInvoiceCandidate {
  invoice_id: string;
  folio: string;
  numero_fiscal: string;
  client_id: string;
  client_name: string;
  client_rut: string;
  total: number;
  issue_date: string;
  due_date: string;
  match_score: number;
  match_reason: string | null;
  amount_matches: boolean;
  already_paid: boolean;
}

const IMPORTS_QUERY_KEY = ['bank-statement-imports'];
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export const useBankStatementReconciliation = () => {
  const queryClient = useQueryClient();
  const { handleError } = useErrorHandler();
  const [sessionImportIds, setSessionImportIds] = useState<string[]>([]);
  const [selectedImportId, setSelectedImportId] = useState<string | null>(null);
  const [candidateMap, setCandidateMap] = useState<Record<string, BankStatementInvoiceCandidate[]>>({});
  const [allPaidMovementIds, setAllPaidMovementIds] = useState<Set<string>>(new Set());
  const [loadingCandidatesMovementId, setLoadingCandidatesMovementId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [reconcilingMovementId, setReconcilingMovementId] = useState<string | null>(null);
  const [exceptingMovementId, setExceptingMovementId] = useState<string | null>(null);
  const sessionImportIdsRef = useRef<string[]>([]);
  const accessTokenRef = useRef<string | null>(null);
  const cleanupTriggeredRef = useRef(false);

  useEffect(() => {
    sessionImportIdsRef.current = sessionImportIds;
  }, [sessionImportIds]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        accessTokenRef.current = data.session?.access_token ?? null;
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      accessTokenRef.current = session?.access_token ?? null;
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const cleanupSessionImports = useCallback(() => {
    if (cleanupTriggeredRef.current) return;

    const importIds = sessionImportIdsRef.current;
    const accessToken = accessTokenRef.current;

    if (importIds.length === 0 || !accessToken || !SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      return;
    }

    cleanupTriggeredRef.current = true;

    void fetch(`${SUPABASE_URL}/rest/v1/rpc/cleanup_bank_statement_imports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ p_import_ids: importIds }),
      keepalive: true,
    }).catch((error) => {
      cleanupTriggeredRef.current = false;
      logger.warn('Error cleaning temporary bank statement imports:', error);
    });
  }, []);

  useEffect(() => {
    const handlePageHide = () => cleanupSessionImports();
    const handleBeforeUnload = () => cleanupSessionImports();

    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      cleanupSessionImports();
    };
  }, [cleanupSessionImports]);

  const importsQuery = useQuery({
    queryKey: [...IMPORTS_QUERY_KEY, sessionImportIds],
    queryFn: async (): Promise<BankStatementImport[]> => {
      if (sessionImportIds.length === 0) return [];

      const { data, error } = await supabase
        .from('bank_statement_imports')
        .select('*')
        .in('id', sessionImportIds)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data ?? [];
    },
    enabled: sessionImportIds.length > 0,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const movementsQuery = useQuery({
    queryKey: ['bank-statement-movements', selectedImportId],
    queryFn: async (): Promise<BankStatementMovement[]> => {
      if (!selectedImportId) return [];

      const { error: syncError } = await supabase.rpc('sync_bank_statement_movement_statuses', {
        p_import_id: selectedImportId,
      });

      if (syncError) {
        logger.warn('Could not sync bank statement movement statuses before fetch:', syncError);
      }

      const { data, error } = await supabase
        .from('bank_statement_movements')
        .select('*')
        .eq('import_id', selectedImportId)
        .order('transaction_date', { ascending: false })
        .order('row_index', { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(selectedImportId),
    staleTime: 10000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!importsQuery.data?.length) {
      setSelectedImportId(null);
      return;
    }

    if (!selectedImportId) {
      setSelectedImportId(importsQuery.data[0].id);
      return;
    }

    const stillExists = importsQuery.data.some((statementImport) => statementImport.id === selectedImportId);
    if (!stillExists) {
      setSelectedImportId(importsQuery.data[0].id);
    }
  }, [importsQuery.data, selectedImportId]);

  const selectedImport = useMemo(
    () => importsQuery.data?.find((statementImport) => statementImport.id === selectedImportId) ?? null,
    [importsQuery.data, selectedImportId],
  );

  const uploadStatement = useCallback(
    async (file: File) => {
      if (!isSupportedBankStatementFile(file)) {
        const error = new Error(
          'La importación automática de cartolas acepta archivos XLS, XLSX o PDF compatibles.',
        );
        handleError(error, {
          title: 'Formato aún no soportado',
          customMessage: error.message,
        });
        throw error;
      }

      setIsUploading(true);

      try {
        const buffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const contentHash = Array.from(new Uint8Array(hashBuffer))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');

        const parsed = await parseBankStatementFile(file);
        const movementRows = parsed.movements.map((movement) => ({
          row_index: movement.rowIndex,
          transaction_date: movement.transactionDate,
          posted_date: movement.postedDate,
          amount: movement.amount,
          currency: movement.currency,
          description: movement.description,
          reference_id: movement.referenceId,
          payer_name: movement.payerName,
          raw_payload: movement.rawPayload,
        }));

        const processingSummary = {
          parser: parsed.parserName,
          file_size_bytes: file.size,
          parsed_summary: parsed.summary,
          imported_at: new Date().toISOString(),
        };

        const { data, error } = await supabase.rpc('create_bank_statement_import', {
          p_file_name: file.name,
          p_file_type: parsed.fileType,
          p_bank_name: parsed.bankName ?? undefined,
          p_processing_summary: processingSummary,
          p_movements: movementRows,
          p_content_hash: contentHash,
        });

        if (error) throw error;

        const result = (data ?? {}) as {
          import_id?: string;
          total_movements?: number;
          success?: boolean;
          duplicate?: boolean;
          message?: string;
        };

        if (!result.import_id || result.success !== true) {
          throw new Error('No se pudo crear la importación de cartola');
        }

        if (result.duplicate) {
          toast.info('Esta cartola ya fue importada anteriormente', {
            description: 'Mostrando los movimientos de la importación existente.',
            duration: 5000,
          });
          setSelectedImportId(result.import_id as string);
          setSessionImportIds((currentIds) =>
            currentIds.includes(result.import_id as string)
              ? currentIds
              : [result.import_id as string, ...currentIds],
          );
          await queryClient.invalidateQueries({ queryKey: IMPORTS_QUERY_KEY });
          return result;
        }

        setCandidateMap({});
        setAllPaidMovementIds(new Set());
        setSessionImportIds((currentIds) =>
          currentIds.includes(result.import_id as string) ? currentIds : [result.import_id as string, ...currentIds],
        );
        setSelectedImportId(result.import_id);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: IMPORTS_QUERY_KEY }),
          queryClient.invalidateQueries({ queryKey: ['bank-statement-movements', result.import_id] }),
        ]);

        toast.success(
          `Cartola importada: ${result.total_movements ?? movementRows.length} movimientos, ${parsed.summary.positiveMovements} abonos positivos listos para revisión.`,
        );

        return result;
      } catch (error) {
        logger.error('Error importing bank statement:', error);
        handleError(error, {
          title: 'Error al importar cartola',
          context: 'useBankStatementReconciliation - uploadStatement',
        });
        throw error;
      } finally {
        setIsUploading(false);
      }
    },
    [handleError, queryClient],
  );

  const loadCandidates = useCallback(
    async (movementId: string, force = false) => {
      if (!force && candidateMap[movementId]) {
        return candidateMap[movementId];
      }

      setLoadingCandidatesMovementId(movementId);

      try {
        const { data, error } = await supabase.rpc('list_bank_statement_invoice_candidates', {
          p_movement_id: movementId,
        });

        if (error) throw error;

        const candidates = (data ?? []) as BankStatementInvoiceCandidate[];
        setCandidateMap((prev) => ({ ...prev, [movementId]: candidates }));

        if (candidates.length > 0 && candidates.every((c) => c.already_paid)) {
          setAllPaidMovementIds((prev) => new Set([...prev, movementId]));
        } else {
          setAllPaidMovementIds((prev) => {
            const next = new Set(prev);
            next.delete(movementId);
            return next;
          });
        }

        return candidates;
      } catch (error) {
        logger.error('Error loading invoice candidates:', error);
        handleError(error, {
          title: 'Error al buscar candidatas',
          context: 'useBankStatementReconciliation - loadCandidates',
        });
        throw error;
      } finally {
        setLoadingCandidatesMovementId((current) => (current === movementId ? null : current));
      }
    },
    [candidateMap, handleError],
  );

  const markMovementException = useCallback(
    async (movementId: string, reason?: string) => {
      setExceptingMovementId(movementId);

      try {
        const { data, error } = await supabase.rpc('mark_bank_statement_movement_exception', {
          p_movement_id: movementId,
          p_reason: reason,
        });

        if (error) throw error;

        await queryClient.invalidateQueries({ queryKey: ['bank-statement-movements', selectedImportId] });
        toast.success('Movimiento marcado como excepción');
        return data;
      } catch (error) {
        logger.error('Error marking bank statement movement as exception:', error);
        handleError(error, {
          title: 'Error al marcar excepción',
          context: 'useBankStatementReconciliation - markMovementException',
        });
        throw error;
      } finally {
        setExceptingMovementId(null);
      }
    },
    [handleError, queryClient, selectedImportId],
  );

  const reconcileMovement = useCallback(
    async (movementId: string, invoiceId: string) => {
      setReconcilingMovementId(movementId);

      try {
        const { data, error } = await supabase.rpc('reconcile_bank_statement_movement_full', {
          p_movement_id: movementId,
          p_invoice_id: invoiceId,
        });

        if (error) throw error;

        const result = (data ?? {}) as {
          movement_id?: string;
          invoice_id?: string;
          payment_id?: string;
          success?: boolean;
        };

        queryClient.setQueryData<BankStatementMovement[]>(
          ['bank-statement-movements', selectedImportId],
          (currentMovements) =>
            (currentMovements ?? []).map((movement) =>
              movement.id === movementId
                ? {
                    ...movement,
                    reconciliation_status: 'reconciled',
                    matched_invoice_id: result.invoice_id ?? invoiceId,
                    payment_id: result.payment_id ?? movement.payment_id,
                    reconciled_at: new Date().toISOString(),
                  }
                : movement,
            ),
        );

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: [...IMPORTS_QUERY_KEY, sessionImportIds] }),
          queryClient.invalidateQueries({ queryKey: ['bank-statement-movements', selectedImportId] }),
        ]);

        toast.success('Movimiento conciliado correctamente con pago total exacto');
        return data;
      } catch (error) {
        logger.error('Error reconciling bank statement movement:', error);
        handleError(error, {
          title: 'Error al conciliar movimiento',
          context: 'useBankStatementReconciliation - reconcileMovement',
        });
        throw error;
      } finally {
        setReconcilingMovementId(null);
      }
    },
    [handleError, queryClient, selectedImportId, sessionImportIds],
  );

  return {
    imports: importsQuery.data ?? [],
    importsLoading: importsQuery.isLoading,
    importsRefetch: importsQuery.refetch,
    movements: movementsQuery.data ?? [],
    movementsLoading: movementsQuery.isLoading,
    movementsRefetch: movementsQuery.refetch,
    selectedImport,
    selectedImportId,
    setSelectedImportId,
    candidateMap,
    allPaidMovementIds,
    loadCandidates,
    loadingCandidatesMovementId,
    uploadStatement,
    isUploading,
    markMovementException,
    exceptingMovementId,
    reconcileMovement,
    reconcilingMovementId,
  };
};
