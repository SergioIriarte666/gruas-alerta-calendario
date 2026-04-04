import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Commission } from '@/types/commissions';

const COMMISSION_CATEGORY_ID = '440296d4-09c2-4f3a-b02b-835f861df4c4';

const mapRawCommissionToCommission = (commission: any): Commission => {
  const serviceValue = commission.service_value || 0;
  const commissionAmount = Number(commission.amount);
  const commissionPercentage = serviceValue > 0 ? (commissionAmount / serviceValue) * 100 : 0;

  return {
    ...commission,
    amount: commissionAmount,
    payment_date: commission.payment_date,
    payment_batch_id: commission.payment_batch_id,
    status: commission.payment_date ? 'paid' as const : 'pending' as const,
    commission_percentage: Math.round(commissionPercentage * 100) / 100,
    service_value: serviceValue,
    client_name: commission.client_name || 'Cliente no disponible',
    services: commission.service_id ? {
      id: commission.service_id,
      folio: commission.service_folio || '',
      service_date: commission.service_date || '',
      value: serviceValue,
      clients: { name: commission.client_name || 'Cliente no disponible' }
    } : undefined,
    operators: commission.operator_id ? {
      id: commission.operator_id,
      name: commission.operator_name || 'Operador no disponible',
      rut: commission.operator_rut || ''
    } : undefined
  };
};

const fetchCommissionCategoryIds = async (): Promise<string[]> => {
  const { data, error } = await supabase
    .from('cost_categories')
    .select('id, name');

  if (error) return [];
  const normalize = (text: string) =>
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  return (data || [])
    .filter((c: any) => {
      const name = normalize(String(c.name || ''));
      return name.includes('comision') && name.includes('operador');
    })
    .map((c: any) => c.id)
    .filter(Boolean);
};

/**
 * Fuente de verdad ÚNICA: tabla costs.
 * Se usa como fallback cuando el RPC falla.
 */
const fetchCommissionsFromCosts = async (): Promise<Commission[]> => {
  console.log('🔁 Falling back to costs-based commissions query...');

  const commissionCategoryIds = await fetchCommissionCategoryIds();
  const categoryIdsToUse = [...new Set([COMMISSION_CATEGORY_ID, ...commissionCategoryIds])];

  // Buscar por todas las variantes posibles para no perder comisiones históricas
  const [byCategoryRes, bySubcategoryRes, byDesc1Res, byDesc2Res] = await Promise.all([
    supabase
      .from('costs')
      .select('id, date, description, amount, operator_id, service_id, service_folio, subcategory, created_at, updated_at, payment_date, payment_batch_id, category_id')
      .in('category_id', categoryIdsToUse)
      .order('date', { ascending: false }),
    supabase
      .from('costs')
      .select('id, date, description, amount, operator_id, service_id, service_folio, subcategory, created_at, updated_at, payment_date, payment_batch_id, category_id')
      .in('subcategory', ['comisiones', 'comisiones_pagadas', 'Comisión Operador'])
      .order('date', { ascending: false }),
    supabase
      .from('costs')
      .select('id, date, description, amount, operator_id, service_id, service_folio, subcategory, created_at, updated_at, payment_date, payment_batch_id, category_id')
      .ilike('description', '%Comisión operador%')
      .order('date', { ascending: false }),
    supabase
      .from('costs')
      .select('id, date, description, amount, operator_id, service_id, service_folio, subcategory, created_at, updated_at, payment_date, payment_batch_id, category_id')
      .ilike('description', '%Comision operador%')
      .order('date', { ascending: false }),
  ]);

  const error = byCategoryRes.error || bySubcategoryRes.error || byDesc1Res.error || byDesc2Res.error;
  const mergedById = new Map<string, any>();
  for (const row of byCategoryRes.data || []) mergedById.set(row.id, row);
  for (const row of bySubcategoryRes.data || []) mergedById.set(row.id, row);
  for (const row of byDesc1Res.data || []) mergedById.set(row.id, row);
  for (const row of byDesc2Res.data || []) mergedById.set(row.id, row);
  const costsData = Array.from(mergedById.values());

  if (error) {
    console.error('❌ Error fetching commissions from costs:', error);
    throw new Error(`Error fetching commissions from costs: ${error.message}`);
  }

  if (!costsData || costsData.length === 0) {
    console.log('📭 No commissions found in costs');
    return [];
  }

  const serviceIds = [...new Set(costsData.map(c => c.service_id).filter(Boolean))] as string[];
  const operatorIdsFromCosts = [...new Set(costsData.map(c => c.operator_id).filter(Boolean))] as string[];

  const servicesRes = serviceIds.length > 0
    ? await supabase.from('services').select('id, folio, service_date, value, client_id, operator_id').in('id', serviceIds)
    : { data: [] as any[], error: null as any };

  if (servicesRes.error) {
    throw new Error(`Error fetching services for commissions: ${servicesRes.error.message}`);
  }

  let services = servicesRes.data || [];
  const serviceById = new Map<string, any>(services.map((s: any) => [s.id, s]));
  const serviceByFolio = new Map<string, any>(services.map((s: any) => [s.folio, s]));

  // Fetch missing services by folio when service_id is null but folio exists
  const missingFolios = [...new Set(
    costsData
      .filter(c => !c.service_id && c.service_folio)
      .map(c => c.service_folio as string)
      .filter(Boolean)
      .filter(folio => !(services as any[]).some(s => s.folio === folio))
  )];

  if (missingFolios.length > 0) {
    const { data: servicesByFolio, error: folioErr } = await supabase
      .from('services')
      .select('id, folio, service_date, value, client_id, operator_id')
      .in('folio', missingFolios);
    if (!folioErr && servicesByFolio) {
      services = [...services, ...servicesByFolio];
      for (const s of servicesByFolio) {
        serviceById.set((s as any).id, s);
        serviceByFolio.set((s as any).folio, s);
      }
    }
  }

  const inferredOperatorIds = new Set<string>(operatorIdsFromCosts);
  for (const cost of costsData) {
    if (cost.operator_id) continue;
    const svc = (cost.service_id && serviceById.get(cost.service_id)) || (cost.service_folio && serviceByFolio.get(cost.service_folio));
    if (svc?.operator_id) inferredOperatorIds.add(svc.operator_id);
  }

  const operatorIdsToFetch = Array.from(inferredOperatorIds.values());
  const operatorsRes = operatorIdsToFetch.length > 0
    ? await supabase.from('operators').select('id, name, rut').in('id', operatorIdsToFetch)
    : { data: [] as any[], error: null as any };

  if ((operatorsRes as any).error) {
    throw new Error(`Error fetching operators for commissions: ${(operatorsRes as any).error.message}`);
  }

  const operators = (operatorsRes as any).data || [];
  const operatorById = new Map<string, any>(operators.map((o: any) => [o.id, o]));

  const clientIds = [...new Set(services.map((s: any) => s.client_id).filter(Boolean))] as string[];
  const clientsRes = clientIds.length > 0
    ? await supabase.from('clients').select('id, name').in('id', clientIds)
    : { data: [] as any[], error: null as any };

  if ((clientsRes as any).error) {
    throw new Error(`Error fetching clients for commissions: ${(clientsRes as any).error.message}`);
  }

  const clients = (clientsRes as any).data || [];

  return costsData.map(cost => {
    const service = (cost.service_id && serviceById.get(cost.service_id)) || (cost.service_folio && serviceByFolio.get(cost.service_folio));
    const client = service ? clients.find((c: any) => c.id === service.client_id) : undefined;
    const operatorId = (cost.operator_id || service?.operator_id || 'unknown') as string;
    const operator = operatorId !== 'unknown' ? operatorById.get(operatorId) : undefined;

    const serviceValue = service?.value || 0;
    const commissionAmount = Number(cost.amount);
    const commissionPercentage = serviceValue > 0 ? (commissionAmount / serviceValue) * 100 : 0;
    const clientName = client?.name || 'Cliente no disponible';

    return {
      id: cost.id,
      date: cost.date,
      payment_date: cost.payment_date || undefined,
      payment_batch_id: cost.payment_batch_id || undefined,
      description: cost.description,
      amount: commissionAmount,
      operator_id: operatorId,
      service_id: cost.service_id || undefined,
      service_folio: cost.service_folio || service?.folio || undefined,
      subcategory: cost.subcategory || '',
      created_at: cost.created_at,
      updated_at: cost.updated_at,
      status: cost.payment_date ? 'paid' : 'pending',
      commission_percentage: Math.round(commissionPercentage * 100) / 100,
      service_value: serviceValue,
      client_name: clientName,
      services: service ? {
        id: service.id,
        folio: service.folio,
        service_date: service.service_date,
        value: serviceValue,
        clients: { name: clientName }
      } : undefined,
      operators: operator ? {
        id: operator.id,
        name: operator.name,
        rut: operator.rut
      } : undefined
    };
  });
};

/**
 * fetchCommissions: fuente de verdad ÚNICA = tabla costs
 * 
 * Se eliminó fetchMainOperatorCommissionsFromServices que generaba
 * comisiones fantasma con IDs sintéticos (service-main-{id}).
 * Ahora solo: RPC + fallback costs, deduplicados por id.
 */
const fetchCommissions = async (): Promise<Commission[]> => {
  console.log('🔍 Fetching commissions (single source: costs table)...');
  
  // Try RPC first
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_commissions_with_details');
    
    if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
      const mapped = rpcData.map(mapRawCommissionToCommission);
      console.log('✅ Commissions from RPC:', mapped.length);
      return mapped;
    }
    
    if (rpcError) {
      console.warn('⚠️ RPC error:', rpcError.message, rpcError.code, rpcError.details);
    } else {
      console.warn('⚠️ RPC returned empty/invalid data, trying costs fallback');
    }
  } catch (e) {
    console.error('❌ RPC exception:', e);
  }

  // Fallback to costs table
  try {
    const costsData = await fetchCommissionsFromCosts();
    console.log('✅ Commissions from costs fallback:', costsData.length);
    return costsData;
  } catch (e) {
    console.error('❌ Costs fallback failed:', e);
    throw e;
  }
};

export const useCommissions = () => {
  return useQuery<Commission[], Error>({
    queryKey: ['commissions'],
    queryFn: fetchCommissions,
  });
};

export const useCommissionsByOperator = (operatorId: string) => {
  return useQuery<Commission[], Error>({
    queryKey: ['commissions', 'by-operator', operatorId],
    queryFn: async () => {
      const all = await fetchCommissions();
      return all.filter(c => c.operator_id === operatorId);
    },
    enabled: !!operatorId,
  });
};
