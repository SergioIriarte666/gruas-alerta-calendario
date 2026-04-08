import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDebounce } from './useDebounce';
import { useCostCategories } from './useCostCategories';
import { CostCategory } from '@/types/costs';

interface ClassificationResult {
  category_id: string | null;
  subcategory: string | null;
  confidence: number;
}

interface UseAutoClassifyReturn {
  suggestion: ClassificationResult | null;
  isClassifying: boolean;
  categoryName: string | null;
  clearSuggestion: () => void;
}

// Simple in-memory cache
const classifyCache = new Map<string, ClassificationResult>();

export const useAutoClassify = (
  description: string,
  currentCategoryId?: string | null,
  enabled: boolean = true
): UseAutoClassifyReturn => {
  const [suggestion, setSuggestion] = useState<ClassificationResult | null>(null);
  const [isClassifying, setIsClassifying] = useState(false);
  const { data: categories = [] } = useCostCategories();
  const abortRef = useRef<AbortController | null>(null);

  const debouncedDescription = useDebounce(description, 800);

  const clearSuggestion = useCallback(() => {
    setSuggestion(null);
  }, []);

  // Get category name for display
  const categoryName = suggestion?.category_id
    ? categories.find(c => c.id === suggestion.category_id)?.name || null
    : null;

  useEffect(() => {
    // Don't classify if disabled, too short, or user already selected a category
    if (!enabled || !debouncedDescription || debouncedDescription.trim().length < 5 || categories.length === 0) {
      setSuggestion(null);
      return;
    }

    // If user already has a category selected, don't suggest
    if (currentCategoryId) {
      setSuggestion(null);
      return;
    }

    const cacheKey = debouncedDescription.trim().toLowerCase();
    
    // Check cache
    if (classifyCache.has(cacheKey)) {
      setSuggestion(classifyCache.get(cacheKey)!);
      return;
    }

    // Cancel previous request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const classify = async () => {
      setIsClassifying(true);
      try {
        // Build categories with subcategories for the AI
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
          setSuggestion(null);
          return;
        }

        const result: ClassificationResult = {
          category_id: data?.category_id || null,
          subcategory: data?.subcategory || null,
          confidence: data?.confidence || 0,
        };

        // Only show if confidence is sufficient
        if (result.confidence >= 0.5 && result.category_id) {
          classifyCache.set(cacheKey, result);
          setSuggestion(result);
        } else {
          setSuggestion(null);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error('Classification failed:', err);
          setSuggestion(null);
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
  }, [debouncedDescription, categories, currentCategoryId, enabled]);

  return { suggestion, isClassifying, categoryName, clearSuggestion };
};
