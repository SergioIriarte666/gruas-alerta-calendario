import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('usePaymentReassignment');

export interface PaymentInfo {
  id: string;
  amount: number;
  payment_date: string;
  bank_reference: string | null;
  payment_method: string;
  status: string;
  applied_amount: number;
  remaining_amount: number;
  clientName: string;
  clientId: string;
  applications: Array<{
    id: string;
    invoice_id: string;
    invoice_folio: string;
    applied_amount: number;
  }>;
}

export interface AvailableInvoice {
  id: string;
  folio: string;
  total: number;
  remaining_amount: number;
}

async function recalcInvoice(invoiceId: string) {
  const { data: apps } = await supabase
    .from('payment_applications')
    .select('applied_amount')
    .eq('invoice_id', invoiceId);

  const totalPaid = (apps || []).reduce((sum, a) => sum + (a.applied_amount || 0), 0);
  const { data: inv } = await supabase.from('invoices').select('total').eq('id', invoiceId).single();

  if (inv) {
    await supabase.from('invoices').update({
      paid_amount: totalPaid,
      remaining_amount: inv.total - totalPaid,
      updated_at: new Date().toISOString(),
    }).eq('id', invoiceId);
  }
}

async function recalcPayment(paymentId: string) {
  const { data: apps } = await supabase
    .from('payment_applications')
    .select('applied_amount')
    .eq('payment_id', paymentId);

  const totalApplied = (apps || []).reduce((sum, a) => sum + (a.applied_amount || 0), 0);
  const { data: p } = await supabase.from('payments').select('amount').eq('id', paymentId).single();

  if (p) {
    await supabase.from('payments').update({
      applied_amount: totalApplied,
      remaining_amount: p.amount - totalApplied,
      status: totalApplied === 0 ? 'pending' : totalApplied >= p.amount ? 'applied' : 'partial',
      updated_at: new Date().toISOString(),
    }).eq('id', paymentId);
  }
}

export function usePaymentReassignment() {
  const searchPayment = async (searchInput: string): Promise<PaymentInfo> => {
    const trimmed = searchInput.trim();
    let query = supabase.from('payments').select('*, client:clients!payments_client_id_fkey(id, name)');

    if (trimmed.startsWith('$') || !isNaN(Number(trimmed))) {
      const amount = Number(trimmed.replace('$', '').replace(/,/g, ''));
      query = query.eq('amount', amount);
    } else {
      query = query.ilike('bank_reference', `%${trimmed}%`);
    }

    const { data: payments, error: pErr } = await query.limit(1);
    if (pErr) throw pErr;
    if (!payments || payments.length === 0) {
      throw new Error('No se encontró pago con esa referencia o monto');
    }

    const p = payments[0];
    const clientObj = p.client as { id?: string; name?: string };

    // Get applications
    const { data: apps } = await supabase
      .from('payment_applications')
      .select('id, invoice_id, applied_amount')
      .eq('payment_id', p.id);

    const appsList: PaymentInfo['applications'] = [];
    for (const app of apps || []) {
      const { data: inv } = await supabase
        .from('invoices')
        .select('folio')
        .eq('id', app.invoice_id)
        .single();
      appsList.push({
        id: app.id,
        invoice_id: app.invoice_id,
        invoice_folio: inv?.folio || 'Desconocida',
        applied_amount: app.applied_amount,
      });
    }

    return {
      id: p.id,
      amount: p.amount,
      payment_date: p.payment_date,
      bank_reference: p.bank_reference,
      payment_method: p.payment_method,
      status: p.status,
      applied_amount: p.applied_amount,
      remaining_amount: p.remaining_amount,
      clientName: clientObj?.name || 'Sin cliente',
      clientId: clientObj?.id || '',
      applications: appsList,
    };
  };

  const fetchAvailableInvoices = async (clientId: string): Promise<AvailableInvoice[]> => {
    const { data: invoices } = await supabase
      .from('invoices')
      .select('id, folio, total, remaining_amount')
      .eq('client_id', clientId)
      .gt('remaining_amount', 0)
      .neq('status', 'cancelled')
      .order('folio', { ascending: false });
    return invoices || [];
  };

  const removeApplication = async (paymentId: string, appId: string, appInvoiceId: string, appAmount: number, appFolio: string): Promise<string> => {
    const { error: delErr } = await supabase.from('payment_applications').delete().eq('id', appId);
    if (delErr) throw delErr;

    await recalcInvoice(appInvoiceId);
    await recalcPayment(paymentId);

    return `Se eliminó la aplicación de ${appFolio}`;
  };

  const reassignApplication = async (
    paymentId: string,
    appId: string,
    oldInvoiceId: string,
    targetInvoiceId: string,
    oldFolio: string,
    targetFolio: string
  ): Promise<string> => {
    const { error: updErr } = await supabase
      .from('payment_applications')
      .update({ invoice_id: targetInvoiceId })
      .eq('id', appId);
    if (updErr) throw updErr;

    await recalcInvoice(oldInvoiceId);
    await recalcInvoice(targetInvoiceId);

    return `Movido de ${oldFolio} a ${targetFolio}`;
  };

  return { searchPayment, fetchAvailableInvoices, removeApplication, reassignApplication };
}
