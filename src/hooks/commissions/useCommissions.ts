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

const fetchMainOperatorCommissionsFromServices = async ({
  operatorId,
  sinceDate,
}: {
  operatorId?: string;
  sinceDate?: string;
}): Promise<Commission[]> => {
  const base = supabase
    .from('services')
    .select('id, folio, service_date, value, operator_id, operator_commission, client_id, created_at, updated_at, status')
    .gt('operator_commission', 0)
    .not('operator_id', 'is', null);

  let query: any = base;
  if (operatorId) query = query.eq('operator_id', operatorId);
  if (sinceDate) query = query.gte('service_date', sinceDate);
  query = query.in('status', ['completed', 'invoiced']).order('service_date', { ascending: false });

  const { data: servicesData, error } = await query;
  if (error) {
    console.error('❌ Error fetching main operator commissions from services:', error);
    return [];
  }

  if (!servicesData || servicesData.length === 0) return [];

  const operatorIds = [...new Set(servicesData.map((s: any) => s.operator_id).filter(Boolean))] as string[];
  const clientIds = [...new Set(servicesData.map((s: any) => s.client_id).filter(Boolean))] as string[];

  const [operatorsRes, clientsRes] = await Promise.all([
    operatorIds.length > 0
      ? supabase.from('operators').select('id, name, rut').in('id', operatorIds)
      : Promise.resolve({ data: [] as any[], error: null as any }),
    clientIds.length > 0
      ? supabase.from('clients').select('id, name').in('id', clientIds)
      : Promise.resolve({ data: [] as any[], error: null as any }),
  ]);

  const operators = operatorsRes.data || [];
  const clients = clientsRes.data || [];

  const operatorById = new Map<string, any>(operators.map((o: any) => [o.id, o]));
  const clientById = new Map<string, any>(clients.map((c: any) => [c.id, c]));

  return servicesData.map((s: any) => {
    const op = operatorById.get(s.operator_id);
    const client = clientById.get(s.client_id);
    const serviceValue = s.value || 0;
    const commissionAmount = Number(s.operator_commission || 0);
    const commissionPercentage = serviceValue > 0 ? (commissionAmount / serviceValue) * 100 : 0;
    const clientName = client?.name || 'Cliente no disponible';

    return {
      id: `service-main-${s.id}`,
      date: s.service_date,
      description: `Comisión operador - Servicio ${s.folio}`,
      amount: commissionAmount,
      operator_id: s.operator_id,
      service_id: s.id,
      service_folio: s.folio,
      subcategory: 'comisiones',
      created_at: s.created_at || new Date().toISOString(),
      updated_at: s.updated_at || new Date().toISOString(),
      status: 'pending',
      commission_percentage: Math.round(commissionPercentage * 100) / 100,
      service_value: serviceValue,
      client_name: clientName,
      services: {
        id: s.id,
        folio: s.folio,
        service_date: s.service_date,
        value: serviceValue,
        clients: { name: clientName },
      },
      operators: op
        ? { id: op.id, name: op.name, rut: op.rut }
        : undefined,
    };
  });
};

const fetchCommissionsFromCosts = async (): Promise<Commission[]> => {
  console.log('🔁 Falling back to costs-based commissions query...');

  const commissionCategoryIds = await fetchCommissionCategoryIds();
  const categoryIdsToUse = [...new Set([COMMISSION_CATEGORY_ID, ...commissionCategoryIds])];

  const [byCategoryRes, bySubcategoryRes, byDesc1Res, byDesc2Res] = await Promise.all([
    supabase
      .from('costs')
      .select('id, date, description, amount, operator_id, service_id, service_folio, subcategory, created_at, updated_at, payment_date, payment_batch_id, category_id')
      .in('category_id', categoryIdsToUse)
      .order('date', { ascending: false }),
    supabase
      .from('costs')
      .select('id, date, description, amount, operator_id, service_id, service_folio, subcategory, created_at, updated_at, payment_date, payment_batch_id, category_id')
      .in('subcategory', ['comisiones', 'comisiones_pagadas'])
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

  const [servicesRes] = await Promise.all([
    serviceIds.length > 0
      ? supabase.from('services').select('id, folio, service_date, value, client_id, operator_id').in('id', serviceIds)
      : Promise.resolve({ data: [] as any[], error: null as any }),
  ]);

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

const fetchCommissions = async (): Promise<Commission[]> => {
  console.log('🔍 Fetching commissions with new function...');
  
  const [rpcRes, costsRes, mainRes] = await Promise.allSettled<Commission[] | any>([
    supabase.rpc('get_commissions_with_details'),
    (async () => fetchCommissionsFromCosts())(),
    (async () => {
      const since = new Date();
      since.setMonth(since.getMonth() - 6); // limitar a últimos 6 meses para evitar historiales antiguos ya pagados
      const sinceDate = since.toISOString().slice(0, 10);
      return fetchMainOperatorCommissionsFromServices({ sinceDate });
    })(),
  ]);

  let rpcData: any[] = [];
  if (rpcRes.status === 'fulfilled') {
    const { data, error } = rpcRes.value as any;
    if (!error && Array.isArray(data)) {
      rpcData = data;
    } else {
      console.warn('⚠️ RPC returned error or invalid data, will rely on costs fallback');
    }
  } else {
    console.warn('⚠️ RPC request failed:', rpcRes.reason);
  }

  let costsData: Commission[] = [];
  if (costsRes.status === 'fulfilled') {
    costsData = costsRes.value as Commission[];
  } else {
    console.warn('⚠️ Costs fallback request failed:', costsRes.reason);
  }

  let mainData: Commission[] = [];
  if (mainRes.status === 'fulfilled') {
    mainData = mainRes.value as Commission[];
  } else {
    console.warn('⚠️ Main commissions request failed:', mainRes.reason);
  }

  const mappedRpc = rpcData.map(mapRawCommissionToCommission);
  const mergedById = new Map<string, Commission>();
  for (const c of mappedRpc) mergedById.set(c.id, c);
  for (const c of costsData) mergedById.set(c.id, c);

  const costsPairs = new Set<string>();
  const paidServiceIds = new Set<string>();
  for (const c of costsData) {
    if (c.service_id && c.payment_date) paidServiceIds.add(c.service_id);
  }
  for (const c of [...mappedRpc, ...costsData]) {
    if (c.service_id && c.operator_id) costsPairs.add(`${c.service_id}::${c.operator_id}`);
  }
  for (let c of mainData) {
    if (c.service_id && c.operator_id) {
      // Si ya hay cualquier comisión en costs para ese servicio y operador, saltar
      if (costsPairs.has(`${c.service_id}::${c.operator_id}`)) continue;
      // Si el servicio tiene alguna comisión con payment_date, marcar esta como pagada para no contaminar "pendientes"
      if (paidServiceIds.has(c.service_id)) {
        c = { ...c, status: 'paid', payment_date: c.payment_date || new Date().toISOString().slice(0, 10) };
      }
      // Evitar incluir si el servicio tiene comisiones en costs (cualquier operador) y esta es solo una proyección
      const serviceHasAnyCost = costsData.some(k => k.service_id === c.service_id);
      if (serviceHasAnyCost && c.status !== 'pending') {
        // Permitir si lo marcamos como pagado para mantener trazabilidad, pero no duplicar si ya existe par
        mergedById.set(c.id, c);
        continue;
      }
    }
    mergedById.set(c.id, c);
  }

  const merged = Array.from(mergedById.values());
  console.log('✅ Commissions merged result:', {
    rpc: mappedRpc.length,
    costs: costsData.length,
    main: mainData.length,
    merged: merged.length
  });

  return merged;
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
    queryFn: () => fetchCommissionsByOperator(operatorId),
    enabled: !!operatorId,
  });
};

const fetchCommissionsByOperator = async (operatorId: string): Promise<Commission[]> => {
  console.log('🔍 Fetching commissions for operator with new function:', operatorId);
  
  const [all, main] = await Promise.all([
    fetchCommissions(),
    fetchMainOperatorCommissionsFromServices({ operatorId }),
  ]);

  const costsPairs = new Set<string>();
  for (const c of all) {
    if (c.service_id && c.operator_id) costsPairs.add(`${c.service_id}::${c.operator_id}`);
  }

  const combined = [
    ...all,
    ...main.filter(c => !(c.service_id && c.operator_id && costsPairs.has(`${c.service_id}::${c.operator_id}`))),
  ];

  const operatorCommissions = combined.filter((commission: any) => commission.operator_id === operatorId);

  console.log('✅ Operator commissions loaded successfully:', operatorCommissions.length);

  return operatorCommissions;
};
