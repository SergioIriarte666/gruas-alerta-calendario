export type AIBankSuggestionLike = {
  invoice_id: string | null;
  confidence: number;
  suggestion_type: 'exact' | 'probable' | 'uncertain' | 'none';
};

export type AIBankCandidateLike = {
  invoice_id: string;
  match_score: number;
  amount_matches: boolean;
  already_paid: boolean;
};

const MIN_CONFIDENCE_BY_TYPE: Record<AIBankSuggestionLike['suggestion_type'], number> = {
  exact: 0.72,
  probable: 0.78,
  uncertain: 1,
  none: 1,
};

export const prepareCandidatesForAISuggestion = <T extends AIBankCandidateLike>(candidates: T[]) => {
  const strictPendingCandidates = candidates
    .filter((candidate) => candidate.amount_matches && !candidate.already_paid)
    .sort((left, right) => right.match_score - left.match_score);

  if (strictPendingCandidates.length > 0) {
    const strictPaidDuplicates = candidates
      .filter((candidate) => candidate.amount_matches && candidate.already_paid)
      .sort((left, right) => right.match_score - left.match_score)
      .slice(0, 3);

    return [...strictPendingCandidates, ...strictPaidDuplicates];
  }

  const unpaidCandidates = candidates
    .filter((candidate) => !candidate.already_paid)
    .sort((left, right) => right.match_score - left.match_score);

  if (unpaidCandidates.length > 0) {
    return unpaidCandidates;
  }

  return [...candidates].sort((left, right) => right.match_score - left.match_score);
};

export const getUsableAISuggestedInvoiceId = <T extends AIBankCandidateLike>(
  candidates: T[],
  suggestion?: AIBankSuggestionLike | null,
) => {
  if (!suggestion?.invoice_id) return null;

  const candidate = candidates.find((item) => item.invoice_id === suggestion.invoice_id);
  if (!candidate) return null;
  if (candidate.already_paid || !candidate.amount_matches) return null;

  const minConfidence = MIN_CONFIDENCE_BY_TYPE[suggestion.suggestion_type] ?? 1;
  if (suggestion.confidence < minConfidence) return null;

  return candidate.invoice_id;
};

export const rankCandidatesWithAISuggestion = <T extends AIBankCandidateLike>(
  candidates: T[],
  suggestion?: AIBankSuggestionLike | null,
) => {
  const suggestedInvoiceId = getUsableAISuggestedInvoiceId(candidates, suggestion);
  if (!suggestedInvoiceId) return candidates;

  const candidateIndexMap = new Map(candidates.map((candidate, index) => [candidate.invoice_id, index]));

  return [...candidates].sort((left, right) => {
    const leftSuggested = left.invoice_id === suggestedInvoiceId ? 1 : 0;
    const rightSuggested = right.invoice_id === suggestedInvoiceId ? 1 : 0;

    if (leftSuggested !== rightSuggested) {
      return rightSuggested - leftSuggested;
    }

    return (candidateIndexMap.get(left.invoice_id) ?? 0) - (candidateIndexMap.get(right.invoice_id) ?? 0);
  });
};
