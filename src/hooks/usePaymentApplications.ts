import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { createLogger } from "@/lib/logger";


const logger = createLogger("usePaymentApplications");
export interface PaymentApplicationDetail {
  id: string;
  applied_amount: number;
  application_method: string;
  created_at: string;
  invoice: {
    id: string;
    folio: string;
    numero_fiscal: string;
    total: number;
    paid_amount: number;
    remaining_amount: number;
    issue_date: string;
    due_date: string;
    status: string;
  };
}

export const usePaymentApplications = () => {
  const getPaymentApplicationsDetail = async (paymentId: string): Promise<PaymentApplicationDetail[]> => {
    try {
      const { data, error } = await supabase
        .from('payment_applications')
        .select(`
          id,
          applied_amount,
          application_method,
          created_at,
          invoice:invoices (
            id,
            folio,
            numero_fiscal,
            total,
            paid_amount,
            remaining_amount,
            issue_date,
            due_date,
            status
          )
        `)
        .eq('payment_id', paymentId)
        .order('created_at', { ascending: true });

      if (error) {
        logger.error('Error fetching payment applications:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      logger.error('Error in getPaymentApplicationsDetail:', error);
      toast.error('Error al obtener detalles de aplicación de pago');
      throw error;
    }
  };

  return {
    getPaymentApplicationsDetail
  };
};
