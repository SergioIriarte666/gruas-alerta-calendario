import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Cost } from '@/types/costs';
import { createLogger } from "@/lib/logger";


const logger = createLogger("useServiceCosts");
const fetchServiceCosts = async (serviceId: string): Promise<Cost[]> => {
  logger.debug('🔍 [fetchServiceCosts] Fetching costs for serviceId:', serviceId);
  
  // Consulta simple sin JOINs para evitar duplicados
  const { data: costsData, error } = await supabase
    .from('costs')
    .select('*')
    .eq('service_id', serviceId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('❌ [fetchServiceCosts] Error fetching service costs:', error);
    throw new Error(error.message);
  }

  logger.debug('✅ [fetchServiceCosts] Found unique costs:', costsData?.length || 0);
  logger.debug('📝 [fetchServiceCosts] Unique IDs:', costsData?.map(c => c.id));

  // Obtener datos relacionados por separado para evitar duplicados
  if (!costsData || costsData.length === 0) {
    return [];
  }

  // Obtener categorías únicas
  const categoryIds = [...new Set(costsData.map(c => c.category_id).filter(Boolean))];
  const { data: categories } = await supabase
    .from('cost_categories')
    .select('id, name')
    .in('id', categoryIds);

  // Obtener grúas únicas
  const craneIds = [...new Set(costsData.map(c => c.crane_id).filter(Boolean))];
  const { data: cranes } = await supabase
    .from('cranes')
    .select('id, license_plate, brand, model')
    .in('id', craneIds);

  // Obtener operadores únicos
  const operatorIds = [...new Set(costsData.map(c => c.operator_id).filter(Boolean))];
  const { data: operators } = await supabase
    .from('operators')
    .select('id, name, rut')
    .in('id', operatorIds);

  // Combinar datos sin duplicar
  const enrichedCosts = costsData.map(cost => ({
    ...cost,
    cost_categories: categories?.find(cat => cat.id === cost.category_id) || null,
    cranes: cranes?.find(crane => crane.id === cost.crane_id) || null,
    operators: operators?.find(op => op.id === cost.operator_id) || null
  }));

  return enrichedCosts as any;
};

export const useServiceCosts = (serviceId: string | null) => {
  return useQuery({
    queryKey: ['service-costs', serviceId],
    queryFn: () => fetchServiceCosts(serviceId!),
    enabled: !!serviceId,
    staleTime: 60 * 1000, // 1 minute cache
  });
};