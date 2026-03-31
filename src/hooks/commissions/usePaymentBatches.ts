import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatForDatabase } from '@/utils/timezoneUtils';

interface CreatePaymentBatchData {
  operator_id: string;
  commission_ids: string[];
  payment_method?: string;
  payment_reference?: string;
  notes?: string;
  payment_date: Date;
}

const createPaymentBatch = async (data: CreatePaymentBatchData) => {
  console.log('📦 [usePaymentBatches] Datos recibidos:', JSON.stringify(data, null, 2));
  
  // Generate batch number
  const batchNumber = `LOTE-${Date.now()}`;
  
  // Calculate total amount
  const { data: commissions, error: commissionsError } = await supabase
    .from('costs')
    .select('amount')
    .in('id', data.commission_ids);
    
  if (commissionsError) {
    console.error('❌ [usePaymentBatches] Error fetching commissions:', commissionsError);
    throw new Error(`Error al obtener comisiones: ${commissionsError.message}`);
  }
  
  if (!commissions || commissions.length === 0) {
    throw new Error(`No se encontraron comisiones con los IDs proporcionados (${data.commission_ids.length} IDs)`);
  }
  
  console.log(`✅ [usePaymentBatches] Encontradas ${commissions.length} comisiones de ${data.commission_ids.length} solicitadas`);
  
  const totalAmount = commissions.reduce((sum, c) => sum + Number(c.amount), 0);
  
  const batchData = {
    batch_number: batchNumber,
    operator_id: data.operator_id,
    total_amount: totalAmount,
    commission_count: data.commission_ids.length,
    status: 'paid',
    payment_method: data.payment_method,
    payment_reference: data.payment_reference,
    notes: data.notes,
    commission_ids: data.commission_ids
  };
  
  // Marcar comisiones como pagadas usando la fecha seleccionada por el usuario
  const paymentDateFormatted = formatForDatabase(data.payment_date);
  console.log('📅 [usePaymentBatches] Fecha formateada:', paymentDateFormatted, 'desde:', data.payment_date);
  
  const { data: rpcResult, error: updateError } = await supabase.rpc('update_commission_payment_date', {
    p_commission_ids: data.commission_ids,
    p_payment_date: paymentDateFormatted,
    p_payment_batch_id: batchNumber,
  });
    
  if (updateError) {
    console.error('❌ [usePaymentBatches] Error RPC update_commission_payment_date:', updateError);
    throw new Error(`Error al actualizar comisiones: ${updateError.message}`);
  }
  
  console.log('✅ [usePaymentBatches] RPC result:', rpcResult);
  
  return batchData;
};

export const useCreatePaymentBatch = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createPaymentBatch,
    onSuccess: () => {
      // Invalidate commissions query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
    },
  });
};
