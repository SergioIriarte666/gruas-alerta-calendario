import type { XMLDocumentData } from '@/types/suppliers';

/**
 * Utilidades compartidas de normalización de texto y sugerencia de glosa
 * para imports XML. Usadas por XMLCostUpload y XMLDocumentUpload.
 */

export type HistoricalGlosaCandidate = {
  supplier_id: string;
  description: string | null;
  amount: number | null;
  date?: string | null;
  created_at?: string | null;
};

export type HistoricalGlosaSuggestion = {
  description: string;
  matchCount: number;
  confidence: number;
};

export const GLOSA_STOP_WORDS = new Set([
  'de', 'la', 'el', 'en', 'los', 'las', 'del', 'por', 'con', 'para', 'una', 'uno', 'que', 'mas', 'más',
  'folio', 'factura', 'total', 'neto', 'iva', 'documento',
]);

export const normalizeGlosaText = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const tokenizeGlosaText = (text: string) =>
  normalizeGlosaText(text)
    .split(' ')
    .filter(token => token.length >= 3 && !GLOSA_STOP_WORDS.has(token) && !/^\d+$/.test(token));

export const extractDocumentSimilarityText = (doc: XMLDocumentData) => {
  const itemDescriptions = (doc.items || [])
    .map(item => item.description?.trim())
    .filter(Boolean)
    .join(' ');

  return [doc.description, itemDescriptions, doc.document_type]
    .filter(Boolean)
    .join(' ')
    .trim();
};

export const isSimilarAmount = (left?: number | null, right?: number | null) => {
  if (!left || !right || !isFinite(left) || !isFinite(right) || left <= 0 || right <= 0) return false;
  const ratio = Math.abs(left - right) / Math.max(left, right);
  return ratio <= 0.08;
};

export const buildHistoricalGlosaSuggestion = (
  doc: XMLDocumentData,
  historicalRecords: HistoricalGlosaCandidate[]
): HistoricalGlosaSuggestion | null => {
  if (historicalRecords.length === 0) return null;

  const keywords = tokenizeGlosaText(extractDocumentSimilarityText(doc));
  if (keywords.length === 0) return null;

  const groups = new Map<string, { description: string; totalScore: number; count: number }>();
  const frequentDescriptions = new Map<string, { description: string; count: number }>();

  for (const record of historicalRecords) {
    const candidateDescription = record.description?.trim();
    if (!candidateDescription) continue;

    const normalizedDescription = normalizeGlosaText(candidateDescription);
    const frequentEntry = frequentDescriptions.get(normalizedDescription);
    if (frequentEntry) {
      frequentEntry.count += 1;
    } else {
      frequentDescriptions.set(normalizedDescription, {
        description: candidateDescription,
        count: 1,
      });
    }

    const candidateTokens = tokenizeGlosaText(candidateDescription);
    if (candidateTokens.length === 0) continue;

    const overlap = keywords.filter(keyword =>
      candidateTokens.some(token => token.includes(keyword) || keyword.includes(token))
    );

    const keywordScore = overlap.length / keywords.length;
    const amountBonus = isSimilarAmount(doc.total_amount, Number(record.amount || 0)) ? 0.2 : 0;
    const totalScore = Math.min(1, keywordScore + amountBonus);

    if (overlap.length === 0 || totalScore < 0.45) continue;

    const existing = groups.get(normalizedDescription);
    if (existing) {
      existing.totalScore += totalScore;
      existing.count += 1;
    } else {
      groups.set(normalizedDescription, {
        description: candidateDescription,
        totalScore,
        count: 1,
      });
    }
  }

  let best: { description: string; totalScore: number; count: number } | null = null;
  for (const group of groups.values()) {
    if (!best || group.count > best.count || (group.count === best.count && group.totalScore > best.totalScore)) {
      best = group;
    }
  }

  if (!best) return null;

  const confidence = best.totalScore / best.count;
  if (best.count < 2 && confidence < 0.72) {
    let fallback: { description: string; count: number } | null = null;
    for (const entry of frequentDescriptions.values()) {
      if (!fallback || entry.count > fallback.count) {
        fallback = entry;
      }
    }

    if (!fallback) return null;

    const hasSimilarAmount = historicalRecords.some(record =>
      normalizeGlosaText(record.description || '') === normalizeGlosaText(fallback.description) &&
      isSimilarAmount(doc.total_amount, Number(record.amount || 0))
    );

    if (fallback.count >= 2 && hasSimilarAmount) {
      return {
        description: fallback.description,
        matchCount: fallback.count,
        confidence: 0.62,
      };
    }

    return null;
  }

  if (best.count >= 2 && confidence < 0.5) return null;

  return {
    description: best.description,
    matchCount: best.count,
    confidence,
  };
};

export const getDocumentStateKey = (doc: Pick<XMLDocumentData, 'supplier_rut' | 'folio'>) =>
  `${doc.supplier_rut || 'sin-rut'}::${doc.folio || 'sin-folio'}`;
