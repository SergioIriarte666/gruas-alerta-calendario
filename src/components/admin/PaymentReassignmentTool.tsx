import * as React from 'react';
import { useState } from 'react';
import { Search, ArrowRightLeft, AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';

interface PaymentInfo {
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

interface AvailableInvoice {
  id: string;
  folio: string;
  total: number;
  remaining_amount: number;
}

export const PaymentReassignmentTool = () => {
  const [searchInput, setSearchInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [payment, setPayment] = useState<PaymentInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [availableInvoices, setAvailableInvoices] = useState<AvailableInvoice[]>([]);
  const [targetInvoiceId, setTargetInvoiceId] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [executing, setExecuting] = useState(false);
  const [actionType, setActionType] = useState<'reassign' | 'remove'>('reassign');
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    setSearching(true);
    setError(null);
    setPayment(null);
    setAvailableInvoices([]);

    try {
      // Search by bank_reference or amount
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
      if (!payments || payments.length === 0) { setError('No se encontró pago con esa referencia o monto'); return; }

      const p = payments[0];
      const clientObj = p.client as any;

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

      setPayment({
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
      });

      // Get available invoices for the same client
      if (clientObj?.id) {
        const { data: invoices } = await supabase
          .from('invoices')
          .select('id, folio, total, remaining_amount')
          .eq('client_id', clientObj.id)
          .gt('remaining_amount', 0)
          .neq('status', 'cancelled')
          .order('folio', { ascending: false });
        setAvailableInvoices(invoices || []);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSearching(false);
    }
  };

  const openReassign = (appId: string) => {
    setSelectedAppId(appId);
    setActionType('reassign');
    setConfirmText('');
    setTargetInvoiceId('');
    setConfirmOpen(true);
  };

  const openRemove = (appId: string) => {
    setSelectedAppId(appId);
    setActionType('remove');
    setConfirmText('');
    setConfirmOpen(true);
  };

  const expectedText = 'CONFIRMAR';

  const handleExecute = async () => {
    if (!payment || !selectedAppId || confirmText !== expectedText) return;
    setExecuting(true);

    try {
      const app = payment.applications.find(a => a.id === selectedAppId);
      if (!app) throw new Error('Aplicación no encontrada');

      if (actionType === 'remove') {
        // Remove application and recalculate
        const { error: delErr } = await supabase.from('payment_applications').delete().eq('id', app.id);
        if (delErr) throw delErr;

        // Recalc invoice
        await recalcInvoice(app.invoice_id);
        // Recalc payment
        await recalcPayment(payment.id);

        toast.success('Aplicación eliminada', { description: `Se removió la aplicación de ${formatCurrency(app.applied_amount)} a ${app.invoice_folio}` });
      } else if (actionType === 'reassign' && targetInvoiceId) {
        // Update the application's invoice_id
        const { error: updErr } = await supabase
          .from('payment_applications')
          .update({ invoice_id: targetInvoiceId })
          .eq('id', app.id);
        if (updErr) throw updErr;

        // Recalc both invoices
        await recalcInvoice(app.invoice_id);
        await recalcInvoice(targetInvoiceId);

        const targetInv = availableInvoices.find(i => i.id === targetInvoiceId);
        toast.success('Pago reasignado', { description: `Movido de ${app.invoice_folio} a ${targetInv?.folio}` });
      }

      setConfirmOpen(false);
      setPayment(null);
      setSearchInput('');
    } catch (e: any) {
      toast.error('Error', { description: e.message });
    } finally {
      setExecuting(false);
    }
  };

  const recalcInvoice = async (invoiceId: string) => {
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
  };

  const recalcPayment = async (paymentId: string) => {
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
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
            <ArrowRightLeft className="size-5 text-amber-600" />
            Reconexión de Pagos
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Reasigna pagos a facturas diferentes o elimina aplicaciones incorrectas. Busca por referencia bancaria o monto.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input placeholder="Referencia bancaria o monto" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className="pl-9" />
            </div>
            <Button type="submit" disabled={searching || !searchInput.trim()}>
              {searching ? <Loader2 className="size-4 animate-spin" /> : 'Buscar'}
            </Button>
          </form>
          {error && <div className="mt-3 p-3 rounded-md bg-destructive/10 text-destructive text-sm">{error}</div>}
        </CardContent>
      </Card>

      {payment && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-foreground">
                Pago: {formatCurrency(payment.amount)}
                <Badge className="ml-2 bg-muted text-muted-foreground">{payment.status}</Badge>
              </CardTitle>
              <span className="text-xs text-muted-foreground">{payment.payment_date}</span>
            </div>
            <CardDescription>
              Cliente: <strong>{payment.clientName}</strong>
              {payment.bank_reference && <> · Ref: <span className="font-mono">{payment.bank_reference}</span></>}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="p-2 rounded bg-muted/50 text-center">
                <div className="text-xs text-muted-foreground">Total</div>
                <div className="font-semibold">{formatCurrency(payment.amount)}</div>
              </div>
              <div className="p-2 rounded bg-muted/50 text-center">
                <div className="text-xs text-muted-foreground">Aplicado</div>
                <div className="font-semibold">{formatCurrency(payment.applied_amount)}</div>
              </div>
              <div className="p-2 rounded bg-muted/50 text-center">
                <div className="text-xs text-muted-foreground">Restante</div>
                <div className="font-semibold">{formatCurrency(payment.remaining_amount)}</div>
              </div>
            </div>

            {payment.applications.length > 0 ? (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Aplicaciones ({payment.applications.length})
                </h4>
                <div className="grid gap-2">
                  {payment.applications.map((app) => (
                    <div key={app.id} className="flex items-center justify-between p-2 rounded bg-muted/50 text-sm">
                      <div>
                        <span className="font-mono text-xs">{app.invoice_folio}</span>
                        <span className="ml-2 text-muted-foreground">{formatCurrency(app.applied_amount)}</span>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" onClick={() => openReassign(app.id)}>
                          <ArrowRightLeft className="size-3" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openRemove(app.id)} className="text-destructive">
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-md bg-muted/30 text-sm text-muted-foreground text-center">
                Sin aplicaciones. Este pago está libre.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <AlertTriangle className="size-5 text-amber-600" />
              {actionType === 'reassign' ? 'Reasignar Pago' : 'Eliminar Aplicación'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                {actionType === 'reassign' ? (
                  <>
                    <p>Selecciona la factura destino para reasignar este pago:</p>
                    <Select value={targetInvoiceId} onValueChange={setTargetInvoiceId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar factura destino" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableInvoices.map((inv) => (
                          <SelectItem key={inv.id} value={inv.id}>
                            {inv.folio} - Pendiente: {formatCurrency(inv.remaining_amount || 0)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                ) : (
                  <p>Se eliminará esta aplicación de pago y se recalcularán los montos de la factura y el pago.</p>
                )}
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">
                    Escribe <span className="font-mono font-bold">{expectedText}</span> para confirmar:
                  </label>
                  <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={expectedText} className="font-mono" />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={confirmText !== expectedText || executing || (actionType === 'reassign' && !targetInvoiceId)}
              onClick={handleExecute}
            >
              {executing ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              {actionType === 'reassign' ? 'Reasignar' : 'Eliminar'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
