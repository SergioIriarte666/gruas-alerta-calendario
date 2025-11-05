import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Commission } from '@/types/commissions';

const fetchCommissions = async (): Promise<Commission[]> => {
  console.log('🔍 Fetching commissions with new function...');
  
  const { data, error } = await supabase
    .rpc('get_commissions_with_details');

  if (error) {
    console.error('❌ Error fetching commissions:', error);
    throw new Error(`Error fetching commissions: ${error.message}`);
  }

  if (!data || data.length === 0) {
    console.log('📭 No commissions found');
    return [];
  }

  console.log('✅ Commissions loaded successfully:', data.length);

  return data.map(commission => {
    const serviceValue = commission.service_value || 0;
    const commissionAmount = Number(commission.amount);
    const commissionPercentage = serviceValue > 0 ? (commissionAmount / serviceValue) * 100 : 0;
    
    return {
      ...commission,
      amount: commissionAmount,
      payment_date: commission.payment_date, // Fecha real de pago
      payment_batch_id: commission.payment_batch_id, // ID del lote de pago
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
  });
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
  
  const { data, error } = await supabase
    .rpc('get_commissions_with_details');

  if (error) {
    console.error('❌ Error fetching commissions for operator:', error);
    throw new Error(`Error fetching commissions for operator: ${error.message}`);
  }

  if (!data || data.length === 0) {
    console.log('📭 No commissions found for operator');
    return [];
  }

  // Filter by operator ID on the client side
  const operatorCommissions = data.filter(commission => commission.operator_id === operatorId);

  console.log('✅ Operator commissions loaded successfully:', operatorCommissions.length);

  return operatorCommissions.map(commission => {
    const serviceValue = commission.service_value || 0;
    const commissionAmount = Number(commission.amount);
    const commissionPercentage = serviceValue > 0 ? (commissionAmount / serviceValue) * 100 : 0;
    
    return {
      ...commission,
      amount: commissionAmount,
      payment_date: commission.payment_date, // Fecha real de pago
      payment_batch_id: commission.payment_batch_id, // ID del lote de pago
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
  });
};