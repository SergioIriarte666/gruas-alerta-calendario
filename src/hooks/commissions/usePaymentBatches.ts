import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatForDatabase } from '@/utils/timezoneUtils';
import { createLogger } from "@/lib/logger";


const logger = createLogger("usePaymentBatches");
interface CreatePaymentBatchData {
  operator_id: string;
  commission_ids: string[];
  payment_method?: string;
  payment_reference?: string;
  notes?: string;
  payment_date: Date;
}

const createPaymentBatch = async (data: CreatePaymentBatchData) => {
  logger.debug('📦 [usePaymentBatches] Datos recibidos:', JSON.stringify(data, null, 2));

  // El lote y el pago se crean juntos en BD. Así no puede existir un lote sin
  // costos pagados ni costos pagados sin su lote persistente.
  let paymentDateFormatted: string;
  try {
    paymentDateFormatted = formatForDatabase(data.payment_date);
    if (!paymentDateFormatted || paymentDateFormatted.length < 10) {
      throw new Error(`Fecha inválida: "${paymentDateFormatted}"`);
    }
  } catch (dateError: any) {
    logger.error('❌ [usePaymentBatches] Error formateando fecha:', dateError);
    throw new Error(`Fecha de pago inválida: ${dateError.message}`);
  }
  logger.debug('📅 [usePaymentBatches] Fecha formateada:', paymentDateFormatted, 'desde:', data.payment_date);

  const { data: rpcResult, error: updateError } = await supabase.rpc('create_commission_payment_batch', {
    p_operator_id: data.operator_id,
    p_commission_ids: data.commission_ids,
    p_payment_date: paymentDateFormatted,
    p_payment_method: data.payment_method,
    p_payment_reference: data.payment_reference,
    p_notes: data.notes,
  });
    
  if (updateError) {
    logger.error('❌ [usePaymentBatches] Error RPC create_commission_payment_batch:', updateError);
    throw new Error(`Error al crear el lote de pago: ${updateError.message}`);
  }

  logger.debug('✅ [usePaymentBatches] Lote persistido:', rpcResult);
  return rpcResult;
};

export const useCreatePaymentBatch = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createPaymentBatch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
      queryClient.invalidateQueries({ queryKey: ['costs'] });
    },
  });
};
