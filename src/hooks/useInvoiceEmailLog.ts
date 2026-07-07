import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from "@/lib/logger";

const logger = createLogger('InvoiceEmailLog');

export interface InvoiceEmailLogEntry {
  id: string;
  invoice_id: string;
  email_type: string;
  recipients: string[];
  sent_by: string | null;
  resend_id: string | null;
  success: boolean;
  error_message: string | null;
  sent_at: string;
}

async function fetchEmailLog(invoiceId: string): Promise<InvoiceEmailLogEntry[]> {
  const { data, error } = await supabase
    .from('invoice_email_log')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('sent_at', { ascending: false });

  if (error) {
    logger.error('Error fetching invoice email log:', error);
    throw error;
  }

  return (data ?? []) as InvoiceEmailLogEntry[];
}

export const useInvoiceEmailLog = (invoiceId: string | undefined) => {
  return useQuery({
    queryKey: ['invoice-email-log', invoiceId],
    queryFn: () => fetchEmailLog(invoiceId!),
    enabled: !!invoiceId,
    staleTime: 5 * 60 * 1000,
  });
};
