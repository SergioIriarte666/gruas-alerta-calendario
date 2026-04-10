import { useState, useCallback } from 'react';
import { useCostCategories } from './useCostCategories';
import { useHistoricalClassify } from './costs/useHistoricalClassify';

interface ClassificationResult {
  category_id: string | null;
  subcategory: string | null;
  confidence: number;
}

export type SuggestionSource = 'history';

interface UseAutoClassifyReturn {
  suggestion: ClassificationResult | null;
  isClassifying: boolean;
  categoryName: string | null;
  source: SuggestionSource | null;
  clearSuggestion: () => void;
}

export const useAutoClassify = (
  description: string,
  currentCategoryId?: string | null,
  enabled: boolean = true
): UseAutoClassifyReturn => {
  const { data: categories = [] } = useCostCategories();

  const { suggestion: historicalSuggestion } = useHistoricalClassify(
    description,
    currentCategoryId,
    enabled
  );

  const clearSuggestion = useCallback(() => {
    // No-op since historical is computed, clears when input changes
  }, []);

  const activeSuggestion: ClassificationResult | null = historicalSuggestion
    ? { category_id: historicalSuggestion.category_id, subcategory: historicalSuggestion.subcategory, confidence: historicalSuggestion.confidence }
    : null;

  const source: SuggestionSource | null = historicalSuggestion ? 'history' : null;

  const categoryName = activeSuggestion?.category_id
    ? categories.find(c => c.id === activeSuggestion.category_id)?.name || null
    : null;

  return {
    suggestion: activeSuggestion,
    isClassifying: false,
    categoryName,
    source,
    clearSuggestion,
  };
};
