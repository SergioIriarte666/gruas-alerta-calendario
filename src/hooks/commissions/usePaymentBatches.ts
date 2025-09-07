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
  // Generate batch number
  const batchNumber = `LOTE-${Date.now()}`;
  
  // Calculate total amount
  const { data: commissions, error: commissionsError } = await supabase
    .from('costs')
    .select('amount')
    .in('id', data.commission_ids);
    
  if (commissionsError) {
    throw new Error(`Error fetching commissions: ${commissionsError.message}`);
  }
  
  const totalAmount = commissions.reduce((sum, c) => sum + Number(c.amount), 0);
  
  // Create payment batch record (you might need to create this table)
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
  
  const { error: updateError } = await supabase
    .from('costs')
    .update({ 
      subcategory: 'comisiones_pagadas',
      payment_date: paymentDateFormatted, // Registrar fecha real de pago seleccionada
      payment_batch_id: batchNumber, // Asociar al lote de pago
      notes: `Pagado en lote ${batchNumber} el ${paymentDateFormatted}. ${data.notes || ''}`.trim()
    })
    .in('id', data.commission_ids);
    
  if (updateError) {
    throw new Error(`Error updating commissions: ${updateError.message}`);
  }
  
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