import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SimilarItem {
  id: string;
  name: string;
  sku?: string;
  unit_cost: number;
  current_stock?: number;
  similarity_score: number;
  match_type: 'exact' | 'similar';
}

export interface DuplicateCandidateItem extends SimilarItem {
  created_at?: string;
  is_active?: boolean;
}

export interface DuplicateCandidateGroup {
  id: string;
  normalized_name: string;
  match_type: 'exact' | 'similar';
  confidence: number;
  items: DuplicateCandidateItem[];
  suggested_master_id: string;
}

export interface InventorySimilaritySource {
  id: string;
  name: string;
  sku?: string | null;
  unit_cost?: number | null;
  current_stock?: number;
  created_at?: string;
  is_active?: boolean;
}

export interface SimilarityResult {
  exactMatch?: SimilarItem;
  similarItems: SimilarItem[];
  shouldAlert: boolean;
  alertMessage: string;
}

/**
 * Normaliza el nombre de un producto para búsquedas consistentes
 */
export const normalizeItemName = (name: string): string => {
  if (!name) return '';
  
  return name
    .toLowerCase()
    .trim()
    // Remover acentos y caracteres especiales
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Normalizar espacios múltiples a uno solo
    .replace(/\s+/g, ' ')
    // Remover caracteres especiales comunes pero mantener espacios y guiones
    .replace(/[^\w\s-]/g, '')
    // Normalizar variaciones comunes
    .replace(/\bY\b/g, 'y')
    .replace(/\bDE\b/g, 'de')
    .replace(/\bLA\b/g, 'la')
    .replace(/\bEL\b/g, 'el');
};

/**
 * Calcula la similitud entre dos strings usando algoritmo de Levenshtein
 */
export const calculateSimilarity = (str1: string, str2: string): number => {
  const norm1 = normalizeItemName(str1);
  const norm2 = normalizeItemName(str2);
  
  if (norm1 === norm2) return 1;
  
  const matrix = Array(norm2.length + 1).fill(null).map(() => Array(norm1.length + 1).fill(null));
  
  for (let i = 0; i <= norm1.length; i++) {
    matrix[0][i] = i;
  }
  
  for (let j = 0; j <= norm2.length; j++) {
    matrix[j][0] = j;
  }
  
  for (let j = 1; j <= norm2.length; j++) {
    for (let i = 1; i <= norm1.length; i++) {
      const indicator = norm1[i - 1] === norm2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }
  
  const maxLength = Math.max(norm1.length, norm2.length);
  return maxLength === 0 ? 1 : (maxLength - matrix[norm2.length][norm1.length]) / maxLength;
};

export const buildSimilarItem = (
  item: InventorySimilaritySource,
  similarity: number,
  matchType?: 'exact' | 'similar'
): SimilarItem => ({
  id: item.id,
  name: item.name,
  sku: item.sku || undefined,
  unit_cost: item.unit_cost || 0,
  current_stock: item.current_stock || 0,
  similarity_score: similarity,
  match_type: matchType || (similarity === 1 ? 'exact' : 'similar'),
});

const sortCandidateItems = (items: DuplicateCandidateItem[]) => {
  return [...items].sort((a, b) => {
    const stockDiff = (b.current_stock || 0) - (a.current_stock || 0);
    if (stockDiff !== 0) return stockDiff;

    if (a.name.length !== b.name.length) {
      return a.name.length - b.name.length;
    }

    if (a.created_at && b.created_at) {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }

    return a.name.localeCompare(b.name, 'es');
  });
};

export const suggestMasterItem = (items: DuplicateCandidateItem[]): DuplicateCandidateItem => {
  return sortCandidateItems(items)[0];
};

export const findDuplicateCandidateGroups = (
  items: InventorySimilaritySource[],
  similarityThreshold = 0.88
): DuplicateCandidateGroup[] => {
  const activeItems = items.filter((item) => item.is_active !== false && item.name?.trim());
  const exactGroups = new Map<string, DuplicateCandidateItem[]>();

  activeItems.forEach((item) => {
    const normalizedName = normalizeItemName(item.name);
    if (!normalizedName) return;

    const existing = exactGroups.get(normalizedName) || [];
    existing.push({
      ...buildSimilarItem(item, 1, 'exact'),
      created_at: item.created_at,
      is_active: item.is_active,
    });
    exactGroups.set(normalizedName, existing);
  });

  const candidateGroups: DuplicateCandidateGroup[] = [];
  const consumedItemIds = new Set<string>();

  exactGroups.forEach((groupItems, normalizedName) => {
    if (groupItems.length < 2) return;

    const sortedItems = sortCandidateItems(groupItems);
    sortedItems.forEach((item) => consumedItemIds.add(item.id));
    candidateGroups.push({
      id: `exact-${normalizedName}`,
      normalized_name: normalizedName,
      match_type: 'exact',
      confidence: 1,
      items: sortedItems,
      suggested_master_id: suggestMasterItem(sortedItems).id,
    });
  });

  const remaining = activeItems.filter((item) => !consumedItemIds.has(item.id));
  const processedSimilarIds = new Set<string>();

  for (const seedItem of remaining) {
    if (processedSimilarIds.has(seedItem.id)) continue;

    const similarItems: DuplicateCandidateItem[] = [];

    for (const candidate of remaining) {
      if (candidate.id === seedItem.id || processedSimilarIds.has(candidate.id)) continue;

      const similarity = calculateSimilarity(seedItem.name, candidate.name);
      if (similarity < similarityThreshold) continue;

      if (similarItems.length === 0) {
        similarItems.push({
          ...buildSimilarItem(seedItem, 1, 'similar'),
          created_at: seedItem.created_at,
          is_active: seedItem.is_active,
        });
      }

      similarItems.push({
        ...buildSimilarItem(candidate, similarity, 'similar'),
        created_at: candidate.created_at,
        is_active: candidate.is_active,
      });
    }

    if (similarItems.length < 2) continue;

    const deduped = Array.from(new Map(similarItems.map((item) => [item.id, item])).values());
    deduped.forEach((item) => processedSimilarIds.add(item.id));
    const sortedItems = sortCandidateItems(deduped);
    const confidence = Math.max(
      ...sortedItems
        .filter((item) => item.id !== sortedItems[0].id)
        .map((item) => item.similarity_score)
    );

    candidateGroups.push({
      id: `similar-${sortedItems.map((item) => item.id).join('-')}`,
      normalized_name: normalizeItemName(sortedItems[0].name),
      match_type: 'similar',
      confidence,
      items: sortedItems,
      suggested_master_id: suggestMasterItem(sortedItems).id,
    });
  }

  return candidateGroups.sort((a, b) => {
    if (a.match_type !== b.match_type) {
      return a.match_type === 'exact' ? -1 : 1;
    }
    return b.confidence - a.confidence;
  });
};

/**
 * Busca productos similares en el inventario
 */
export const findSimilarItems = async (partName: string, similarityThreshold = 0.8): Promise<SimilarityResult> => {
  console.log('🔍 [findSimilarItems] Iniciando búsqueda para:', partName);
  
  if (!partName || partName.trim().length < 2) {
    console.log('❌ [findSimilarItems] Nombre demasiado corto:', partName);
    return {
      similarItems: [],
      shouldAlert: false,
      alertMessage: ''
    };
  }

  try {
    console.log('📡 [findSimilarItems] Consultando Supabase...');
    // Obtener todos los items activos del inventario
    const { data: inventoryItems, error } = await supabase
      .from('inventory_items')
      .select(`
        id,
        name,
        sku,
        unit_cost
      `)
      .eq('is_active', true);

    if (error) {
      console.error('❌ [findSimilarItems] Error en consulta Supabase:', error);
      throw error;
    }

    console.log('✅ [findSimilarItems] Items encontrados:', inventoryItems?.length || 0);
    
    if (!inventoryItems || inventoryItems.length === 0) {
      console.log('⚠️ [findSimilarItems] No hay items en inventario');
      return {
        similarItems: [],
        shouldAlert: false,
        alertMessage: ''
      };
    }

    const normalizedInput = normalizeItemName(partName);
    console.log('🔄 [findSimilarItems] Texto normalizado:', `"${partName}" -> "${normalizedInput}"`);
    
    const results: SimilarItem[] = [];
    let exactMatch: SimilarItem | undefined;

    // Obtener stock actual para los items
    const { data: stockData } = await supabase
      .from('inventory_stock')
      .select(`
        item_id,
        current_quantity
      `);

    const stockMap = new Map(stockData?.map(s => [s.item_id, s.current_quantity]) || []);

    for (const item of inventoryItems) {
      const normalizedItemName = normalizeItemName(item.name);
      const similarity = calculateSimilarity(normalizedInput, normalizedItemName);
      
      if (similarity > 0.5) { // Solo log items con cierta similitud
        console.log(`🎯 [findSimilarItems] Comparando "${normalizedInput}" vs "${normalizedItemName}" = ${Math.round(similarity * 100)}%`);
      }
      
      const similarItem: SimilarItem = {
        id: item.id,
        name: item.name,
        sku: item.sku,
        unit_cost: item.unit_cost || 0,
        current_stock: stockMap.get(item.id) || 0,
        similarity_score: similarity,
        match_type: similarity === 1 ? 'exact' : 'similar'
      };

      // Coincidencia exacta
      if (similarity === 1) {
        console.log('🎯 [findSimilarItems] ¡COINCIDENCIA EXACTA encontrada!:', item.name);
        exactMatch = similarItem;
      }
      // Coincidencia similar (por encima del umbral)
      else if (similarity >= similarityThreshold) {
        console.log(`🔍 [findSimilarItems] Similitud alta (${Math.round(similarity * 100)}%):`, item.name);
        results.push(similarItem);
      }
    }

    // Ordenar por similitud descendente
    results.sort((a, b) => b.similarity_score - a.similarity_score);

    // Determinar si mostrar alerta
    const shouldAlert = !!exactMatch || results.length > 0;
    let alertMessage = '';

    if (exactMatch) {
      alertMessage = `⚠️ Producto Existente: "${exactMatch.name}" (Stock: ${exactMatch.current_stock} unidades)`;
    } else if (results.length > 0) {
      const topMatch = results[0];
      const percentage = Math.round(topMatch.similarity_score * 100);
      alertMessage = `⚠️ Producto Similar: "${topMatch.name}" (${percentage}% similar, Stock: ${topMatch.current_stock})`;
    }

    console.log('📊 [findSimilarItems] Resultados finales:');
    console.log(`  - Coincidencia exacta: ${exactMatch ? 'SÍ' : 'NO'}`);
    console.log(`  - Items similares: ${results.length}`);
    console.log(`  - Debe alertar: ${shouldAlert ? 'SÍ' : 'NO'}`);
    console.log(`  - Mensaje: ${alertMessage}`);

    return {
      exactMatch,
      similarItems: results.slice(0, 5), // Máximo 5 sugerencias
      shouldAlert,
      alertMessage
    };
  } catch (error) {
    console.error('Error searching for similar items:', error);
    return {
      similarItems: [],
      shouldAlert: false,
      alertMessage: ''
    };
  }
};

/**
 * Hook para buscar productos similares con debounce
 */
export const useSimilarItemsSearch = (partName: string, enabled = true) => {
  const [results, setResults] = useState<SimilarityResult>({
    similarItems: [],
    shouldAlert: false,
    alertMessage: ''
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    console.log('🚀 [useSimilarItemsSearch] Hook ejecutado:', { partName, enabled, length: partName?.trim().length });
    
    if (!enabled || !partName || partName.trim().length < 2) {
      console.log('⏹️ [useSimilarItemsSearch] Búsqueda deshabilitada o texto muy corto');
      setResults({
        similarItems: [],
        shouldAlert: false,
        alertMessage: ''
      });
      return;
    }

    const timeoutId = setTimeout(async () => {
      console.log('⏱️ [useSimilarItemsSearch] Iniciando búsqueda después de debounce:', partName);
      setIsLoading(true);
      try {
        const similarityResults = await findSimilarItems(partName);
        console.log('✅ [useSimilarItemsSearch] Resultados recibidos:', similarityResults);
        setResults(similarityResults);
      } catch (error) {
        console.error('❌ [useSimilarItemsSearch] Error en búsqueda:', error);
        setResults({
          similarItems: [],
          shouldAlert: false,
          alertMessage: ''
        });
      } finally {
        setIsLoading(false);
      }
    }, 150); // Debounce reducido a 150ms

    return () => clearTimeout(timeoutId);
  }, [partName, enabled]);

  return { ...results, isLoading };
};
