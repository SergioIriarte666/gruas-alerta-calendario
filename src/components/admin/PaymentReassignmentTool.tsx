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
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import { usePaymentReassignment, PaymentInfo, AvailableInvoice } from '@/hooks/usePaymentReassignment';

export const PaymentReassignmentTool = () => {
  const { searchPayment, fetchAvailableInvoices, removeApplication, reassignApplication } = usePaymentReassignment();
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
      const paymentInfo = await searchPayment(searchInput);
      setPayment(paymentInfo);

      if (paymentInfo.clientId) {
        const invoices = await fetchAvailableInvoices(paymentInfo.clientId);
        setAvailableInvoices(invoices);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
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

      let message: string;

      if (actionType === 'remove') {
        message = await removeApplication(payment.id, app.id, app.invoice_id, app.applied_amount, app.invoice_folio);
      } else if (actionType === 'reassign' && targetInvoiceId) {
        const targetInv = availableInvoices.find(i => i.id === targetInvoiceId);
        message = await reassignApplication(
          payment.id, app.id, app.invoice_id, targetInvoiceId,
          app.invoice_folio, targetInv?.folio || targetInvoiceId
        );
      } else {
        throw new Error('Acción no válida');
      }

      toast.success('Operación completada', { description: message });
      setConfirmOpen(false);
      setPayment(null);
      setSearchInput('');
    } catch (e: unknown) {
      toast.error('Error', { description: e instanceof Error ? e.message : 'Error desconocido' });
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
            <ArrowRightLeft className="size-5 text-warning-text" />
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
              <AlertTriangle className="size-5 text-warning-text" />
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
