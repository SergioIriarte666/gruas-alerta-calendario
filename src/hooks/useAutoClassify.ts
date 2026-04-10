import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDebounce } from './useDebounce';
import { useCostCategories } from './useCostCategories';
import { useHistoricalClassify } from './costs/useHistoricalClassify';

interface ClassificationResult {
  category_id: string | null;
  subcategory: string | null;
  confidence: number;
}

export type SuggestionSource = 'history' | 'ai';

interface UseAutoClassifyReturn {
  suggestion: ClassificationResult | null;
  isClassifying: boolean;
  categoryName: string | null;
  source: SuggestionSource | null;
  clearSuggestion: () => void;
}

// Simple in-memory cache for AI results
const classifyCache = new Map<string, ClassificationResult>();

export const useAutoClassify = (
  description: string,
  currentCategoryId?: string | null,
  enabled: boolean = true
): UseAutoClassifyReturn => {
  const [aiSuggestion, setAiSuggestion] = useState<ClassificationResult | null>(null);
  const [isClassifying, setIsClassifying] = useState(false);
  const { data: categories = [] } = useCostCategories();
  const abortRef = useRef<AbortController | null>(null);

  const { suggestion: historicalSuggestion } = useHistoricalClassify(
    description,
    currentCategoryId,
    enabled
  );

  const debouncedDescription = useDebounce(description, 800);

  const clearSuggestion = useCallback(() => {
    setAiSuggestion(null);
  }, []);

  // Determine active suggestion: historical first, then AI
  const activeSuggestion: ClassificationResult | null = historicalSuggestion
    ? { category_id: historicalSuggestion.category_id, subcategory: historicalSuggestion.subcategory, confidence: historicalSuggestion.confidence }
    : aiSuggestion;

  const source: SuggestionSource | null = historicalSuggestion
    ? 'history'
    : aiSuggestion
    ? 'ai'
    : null;

  // Get category name for display
  const categoryName = activeSuggestion?.category_id
    ? categories.find(c => c.id === activeSuggestion.category_id)?.name || null
    : null;

  useEffect(() => {
    // Don't call AI if disabled, too short, user already selected, or historical already has a suggestion
    if (!enabled || !debouncedDescription || debouncedDescription.trim().length < 5 || categories.length === 0) {
      setAiSuggestion(null);
      return;
    }

    if (currentCategoryId) {
      setAiSuggestion(null);
      return;
    }

    // If historical already found a good match, skip AI
    if (historicalSuggestion) {
      setAiSuggestion(null);
      return;
    }

    const cacheKey = debouncedDescription.trim().toLowerCase();
    
    if (classifyCache.has(cacheKey)) {
      setAiSuggestion(classifyCache.get(cacheKey)!);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const classify = async () => {
      setIsClassifying(true);
      try {
        const { data: subcatsData } = await supabase
          .from('cost_subcategories')
          .select('category_id, name')
          .eq('is_active', true);

        const subcatsByCategory = (subcatsData || []).reduce((acc, sub) => {
          if (!acc[sub.category_id]) acc[sub.category_id] = [];
          acc[sub.category_id].push(sub.name);
          return acc;
        }, {} as Record<string, string[]>);

        const categoriesPayload = categories.map(c => ({
          id: c.id,
          name: c.name,
          subcategories: subcatsByCategory[c.id] || [],
        }));

        const { data, error } = await supabase.functions.invoke('classify-cost', {
          body: {
            description: debouncedDescription.trim(),
            categories: categoriesPayload,
          },
        });

        if (controller.signal.aborted) return;

        if (error) {
          console.error('Classification error:', error);
          setAiSuggestion(null);
          return;
        }

        const result: ClassificationResult = {
          category_id: data?.category_id || null,
          subcategory: data?.subcategory || null,
          confidence: data?.confidence || 0,
        };

        if (result.confidence >= 0.5 && result.category_id) {
          classifyCache.set(cacheKey, result);
          setAiSuggestion(result);
        } else {
          setAiSuggestion(null);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error('Classification failed:', err);
          setAiSuggestion(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsClassifying(false);
        }
      }
    };

    classify();

    return () => {
      controller.abort();
    };
  }, [debouncedDescription, categories, currentCategoryId, enabled, historicalSuggestion]);

  return {
    suggestion: activeSuggestion,
    isClassifying: !historicalSuggestion && isClassifying,
    categoryName,
    source,
    clearSuggestion,
  };
};
