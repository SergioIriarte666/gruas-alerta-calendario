import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { BankStatementMovement, BankStatementInvoiceCandidate } from './useBankStatementReconciliation';
import { prepareCandidatesForAISuggestion } from '@/utils/bankStatementAIMatch';

const logger = createLogger('useAIBankMatch');

export type AISuggestionType = 'exact' | 'probable' | 'uncertain' | 'none';

export interface AIBankMatchResult {
  invoice_id: string | null;
  confidence: number;
  reasoning: string;
  suggestion_type: AISuggestionType;
}

export const useAIBankMatch = () => {
  const [aiSuggestion, setAiSuggestion] = useState<AIBankMatchResult | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiCacheMap, setAiCacheMap] = useState<Record<string, AIBankMatchResult>>({});

  const suggestMatch = useCallback(
    async (movement: BankStatementMovement, candidates: BankStatementInvoiceCandidate[], force = false) => {
      if (!force && aiCacheMap[movement.id]) {
        setAiSuggestion(aiCacheMap[movement.id]);
        return aiCacheMap[movement.id];
      }

      setIsLoadingAI(true);
      setAiError(null);
      setAiSuggestion(null);

      try {
        const aiCandidates = prepareCandidatesForAISuggestion(candidates);
        const { data, error } = await supabase.functions.invoke('suggest-bank-match', {
          body: {
            movement: {
              description: movement.description,
              payer_name: movement.payer_name,
              reference_id: movement.reference_id,
              amount: movement.amount,
              transaction_date: movement.transaction_date,
              currency: movement.currency,
            },
            candidates: aiCandidates.map((c) => ({
              invoice_id: c.invoice_id,
              folio: c.folio,
              numero_fiscal: c.numero_fiscal,
              client_name: c.client_name,
              client_rut: c.client_rut,
              total: c.total,
              due_date: c.due_date,
              match_score: c.match_score,
              already_paid: c.already_paid,
            })),
          },
        });

        if (error) throw error;

        const result = data as AIBankMatchResult;
        setAiSuggestion(result);
        setAiCacheMap((prev) => ({ ...prev, [movement.id]: result }));
        return result;
      } catch (err) {
        logger.error('Error calling suggest-bank-match:', err);
        const msg = err instanceof Error ? err.message : 'Error al consultar IA';
        setAiError(msg);
        return null;
      } finally {
        setIsLoadingAI(false);
      }
    },
    [aiCacheMap],
  );

  const clearSuggestion = useCallback(() => {
    setAiSuggestion(null);
    setAiError(null);
  }, []);

  return {
    aiSuggestion,
    isLoadingAI,
    aiError,
    suggestMatch,
    clearSuggestion,
  };
};
