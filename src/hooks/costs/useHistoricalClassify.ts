import { calendarDateString } from '@/utils/calendarDate';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { businessClock } from '@/utils/businessClock';
import { useDebounce } from '@/hooks/useDebounce';

interface HistoricalClassificationResult {
  category_id: string;
  subcategory: string | null;
  confidence: number;
  matchCount: number;
}

// Stop words in Spanish to ignore during tokenization
const STOP_WORDS = new Set([
  'de', 'la', 'el', 'en', 'los', 'las', 'del', 'por', 'con', 'para', 'una', 'uno', 'que', 'más', 'mas',
]);

const tokenize = (text: string): string[] => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .split(/\s+/)
    .filter(word => word.length >= 3 && !STOP_WORDS.has(word));
};

// In-memory cache keyed by normalized description
const historyCache = new Map<string, HistoricalClassificationResult | null>();

export const useHistoricalClassify = (
  description: string,
  currentCategoryId?: string | null,
  enabled: boolean = true
): { suggestion: HistoricalClassificationResult | null; isReady: boolean } => {
  const sixMonthsAgo = (() => {
    const d = new Date(businessClock.todayDate());
    d.setMonth(d.getMonth() - 6);
    return calendarDateString(d);
  })();

  const { data: costs = [] } = useQuery({
    queryKey: ['costs', 'classify-history', sixMonthsAgo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('costs')
        .select('id, description, category_id, subcategory, date')
        .gte('date', sixMonthsAgo)
        .order('date', { ascending: false })
        .limit(500);
      if (error) throw new Error(error.message);
      return data || [];
    },
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled,
  });

  const debouncedDescription = useDebounce(description, 300);

  const suggestion = useMemo(() => {
    if (!enabled || !debouncedDescription || debouncedDescription.trim().length < 5 || currentCategoryId || costs.length === 0) {
      return null;
    }

    const cacheKey = debouncedDescription.trim().toLowerCase();
    if (historyCache.has(cacheKey)) {
      return historyCache.get(cacheKey)!;
    }

    const keywords = tokenize(debouncedDescription);
    if (keywords.length === 0) return null;

    // Find matching costs: at least 1 keyword must appear in description
    const matches = costs.filter(cost => {
      if (!cost.description) return false;
      const costTokens = tokenize(cost.description);
      const matchingKeywords = keywords.filter(kw =>
        costTokens.some(ct => ct.includes(kw) || kw.includes(ct))
      );
      // Require at least 1 keyword match, but weight by how many match
      return matchingKeywords.length >= 1;
    });

    if (matches.length < 2) {
      historyCache.set(cacheKey, null);
      return null;
    }

    // Score matches by keyword overlap ratio
    const scored = matches.map(cost => {
      const costTokens = tokenize(cost.description);
      const matchingKeywords = keywords.filter(kw =>
        costTokens.some(ct => ct.includes(kw) || kw.includes(ct))
      );
      return {
        category_id: cost.category_id,
        subcategory: cost.subcategory,
        score: matchingKeywords.length / keywords.length,
      };
    }).filter(m => m.score >= 0.5); // At least half the keywords must match

    if (scored.length < 2) {
      historyCache.set(cacheKey, null);
      return null;
    }

    // Group by category_id + subcategory and count weighted frequency
    const groups = new Map<string, { category_id: string; subcategory: string | null; totalScore: number; count: number }>();
    
    for (const match of scored) {
      const key = `${match.category_id}::${match.subcategory || ''}`;
      const existing = groups.get(key);
      if (existing) {
        existing.totalScore += match.score;
        existing.count += 1;
      } else {
        groups.set(key, {
          category_id: match.category_id,
          subcategory: match.subcategory,
          totalScore: match.score,
          count: 1,
        });
      }
    }

    // Find the most frequent group
    let best: { category_id: string; subcategory: string | null; totalScore: number; count: number } | null = null;
    for (const group of groups.values()) {
      if (!best || group.count > best.count || (group.count === best.count && group.totalScore > best.totalScore)) {
        best = group;
      }
    }

    if (!best) {
      historyCache.set(cacheKey, null);
      return null;
    }

    const confidence = best.count / scored.length;

    if (confidence < 0.6) {
      historyCache.set(cacheKey, null);
      return null;
    }

    const result: HistoricalClassificationResult = {
      category_id: best.category_id,
      subcategory: best.subcategory,
      confidence,
      matchCount: best.count,
    };

    historyCache.set(cacheKey, result);
    return result;
  }, [debouncedDescription, costs, currentCategoryId, enabled]);

  return { suggestion, isReady: costs.length > 0 };
};
