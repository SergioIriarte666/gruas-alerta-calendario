import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PaymentTerm } from '@/types';
import { toast } from 'sonner';
import { createLogger } from "@/lib/logger";


const logger = createLogger("usePaymentTerms");
const PAYMENT_TERMS_SELECT = `
  id,
  name,
  code,
  days,
  description,
  is_active,
  display_order,
  created_at,
  created_by
`;

export const usePaymentTerms = () => {
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerm[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPaymentTerms = async () => {
    try {
      const { data, error } = await supabase
        .from('payment_terms')
        .select(PAYMENT_TERMS_SELECT)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      setPaymentTerms(data || []);
    } catch (error) {
      logger.error('Error fetching payment terms:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaymentTerms();
  }, []);

  const createPaymentTerm = async (term: Omit<PaymentTerm, 'id' | 'created_at' | 'created_by'>) => {
    try {
      const { data, error } = await supabase
        .from('payment_terms')
        .insert(term)
        .select(PAYMENT_TERMS_SELECT)
        .single();

      if (error) throw error;
      await fetchPaymentTerms();
      toast.success('Condición de pago creada exitosamente');
      return data;
    } catch (error) {
      logger.error('Error creating payment term:', error);
      toast.error('Error al crear condición de pago');
      throw error;
    }
  };

  const updatePaymentTerm = async (id: string, updates: Partial<PaymentTerm>) => {
    try {
      const { data, error } = await supabase
        .from('payment_terms')
        .update(updates)
        .eq('id', id)
        .select(PAYMENT_TERMS_SELECT)
        .single();

      if (error) throw error;
      await fetchPaymentTerms();
      toast.success('Condición de pago actualizada exitosamente');
      return data;
    } catch (error) {
      logger.error('Error updating payment term:', error);
      toast.error('Error al actualizar condición de pago');
      throw error;
    }
  };

  const deletePaymentTerm = async (id: string) => {
    try {
      const { error } = await supabase
        .from('payment_terms')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      await fetchPaymentTerms();
      toast.success('Condición de pago desactivada exitosamente');
    } catch (error) {
      logger.error('Error deleting payment term:', error);
      toast.error('Error al desactivar condición de pago');
      throw error;
    }
  };

  return {
    paymentTerms,
    loading,
    createPaymentTerm,
    updatePaymentTerm,
    deletePaymentTerm,
    refetch: fetchPaymentTerms
  };
};
