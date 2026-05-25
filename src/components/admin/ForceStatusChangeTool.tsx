import * as React from 'react';
import { useState } from 'react';
import { Search, AlertTriangle, RefreshCw, Loader2, FileText, Package, CreditCard } from 'lucide-react';
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
import type { Database } from '@/integrations/supabase/types';

type ServiceStatus = Database['public']['Enums']['service_status'];

const SERVICE_STATUSES: { value: ServiceStatus; label: string }[] = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'in_progress', label: 'En progreso' },
  { value: 'completed', label: 'Completado' },
  { value: 'cancelled', label: 'Cancelado' },
  { value: 'invoiced', label: 'Facturado' },
  { value: 'inspection_completed', label: 'Inspección completada' },
  { value: 'quoted', label: 'Cotizado' },
  { value: 'purchase_order_pending', label: 'OC Pendiente' },
  { value: 'with_purchase_order', label: 'Con OC' },
  { value: 'failed', label: 'Fallido' },
];

const statusColor = (status: string) => {
  switch (status) {
    case 'completed': case 'invoiced': return 'bg-green-100 text-green-800';
    case 'in_progress': return 'bg-blue-100 text-blue-800';
    case 'cancelled': case 'failed': return 'bg-red-100 text-red-800';
    default: return 'bg-muted text-muted-foreground';
  }
};

interface ServiceInfo {
  id: string;
  folio: string;
  status: ServiceStatus;
  value: number;
  clientName: string;
  invoice_folio: string | null;
  hasInvoice: boolean;
  hasClosure: boolean;
  hasPayments: boolean;
}

export const ForceStatusChangeTool = () => {
  const [searchInput, setSearchInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [service, setService] = useState<ServiceInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [targetStatus, setTargetStatus] = useState<ServiceStatus | ''>('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [executing, setExecuting] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    setSearching(true);
    setError(null);
    setService(null);
    setTargetStatus('');

    try {
      const folio = searchInput.trim().toUpperCase();
      const { data: svc, error: svcErr } = await supabase
        .from('services')
        .select('id, folio, status, value, invoice_folio, client:clients!services_client_id_fkey(name)')
        .eq('folio', folio)
        .maybeSingle();

      if (svcErr) throw svcErr;
      if (!svc) { setError(`No se encontró servicio con folio ${folio}`); return; }

      // Check relations
      const [invRes, closRes] = await Promise.all([
        supabase.from('invoice_services').select('id').eq('service_id', svc.id).limit(1),
        supabase.from('closure_services').select('id').eq('service_id', svc.id).limit(1),
      ]);

      const clientObj = svc.client as any;
      setService({
        id: svc.id,
        folio: svc.folio || folio,
        status: svc.status as ServiceStatus,
        value: svc.value || 0,
        clientName: clientObj?.name || 'Sin cliente',
        invoice_folio: svc.invoice_folio,
        hasInvoice: (invRes.data?.length || 0) > 0,
        hasClosure: (closRes.data?.length || 0) > 0,
        hasPayments: false,
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSearching(false);
    }
  };

  const expectedText = service ? `FORZAR ${service.folio}` : '';

  const handleForce = async () => {
    if (!service || !targetStatus || confirmText !== expectedText) return;
    setExecuting(true);

    try {
      const updateData: Record<string, any> = {
        status: targetStatus,
        updated_at: new Date().toISOString(),
      };

      // Clear invoice_folio when moving to non-invoiced states
      if (['pending', 'in_progress', 'completed', 'with_purchase_order', 'quoted', 'purchase_order_pending'].includes(targetStatus)) {
        updateData.invoice_folio = null;
      }

      const { error } = await supabase
        .from('services')
        .update(updateData)
        .eq('id', service.id);

      if (error) throw error;

      toast.success('Estado actualizado', {
        description: `${service.folio} cambiado a "${SERVICE_STATUSES.find(s => s.value === targetStatus)?.label}"`,
      });
      setConfirmOpen(false);
      setConfirmText('');
      setService(null);
      setSearchInput('');
      setTargetStatus('');
    } catch (e: any) {
      toast.error('Error', { description: e.message });
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
            <RefreshCw className="size-5 text-amber-600" />
            Cambio Forzado de Estado
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Forzar el cambio de estado de un servicio cuando queda atascado en un estado incorrecto.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input placeholder="Ej: SRV-6413" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className="pl-9" />
            </div>
            <Button type="submit" disabled={searching || !searchInput.trim()}>
              {searching ? <Loader2 className="size-4 animate-spin" /> : 'Buscar'}
            </Button>
          </form>
          {error && <div className="mt-3 p-3 rounded-md bg-destructive/10 text-destructive text-sm">{error}</div>}
        </CardContent>
      </Card>

      {service && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
                {service.folio}
                <Badge className={statusColor(service.status)}>
                  {SERVICE_STATUSES.find(s => s.value === service.status)?.label || service.status}
                </Badge>
              </CardTitle>
              <span className="text-sm font-semibold">{formatCurrency(service.value)}</span>
            </div>
            <CardDescription>Cliente: <strong>{service.clientName}</strong></CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Relations */}
            <div className="flex gap-2 flex-wrap">
              <Badge variant="outline" className="flex items-center gap-1">
                <FileText className="size-3" />
                Factura: {service.hasInvoice ? '✅ Vinculada' : '❌ Sin vínculo'}
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1">
                <Package className="size-3" />
                Cierre: {service.hasClosure ? '✅ Vinculado' : '❌ Sin vínculo'}
              </Badge>
              {service.invoice_folio && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <CreditCard className="size-3" />
                  Folio factura: {service.invoice_folio}
                </Badge>
              )}
            </div>

            {/* Warnings */}
            {service.hasInvoice && (
              <div className="p-3 rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 text-sm">
                <strong>⚠️ Atención:</strong> Este servicio tiene una factura vinculada. Cambiar el estado no eliminará la relación. Usa "Liberación de Servicios" si necesitas desvincular.
              </div>
            )}

            {/* Target status */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Nuevo estado:</label>
              <Select value={targetStatus} onValueChange={(v) => setTargetStatus(v as ServiceStatus)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar estado destino" />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_STATUSES.filter(s => s.value !== service.status).map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {targetStatus && (
              <div className="p-3 rounded-md border bg-muted/30 text-sm space-y-1">
                <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider">Vista previa del impacto</h4>
                <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                  <li>Estado cambiará de <Badge variant="outline" className="text-[10px]">{SERVICE_STATUSES.find(s => s.value === service.status)?.label}</Badge> a <Badge variant="outline" className="text-[10px]">{SERVICE_STATUSES.find(s => s.value === targetStatus)?.label}</Badge></li>
                  {['pending', 'in_progress', 'completed', 'with_purchase_order'].includes(targetStatus) && service.invoice_folio && (
                    <li>Se limpiará el campo invoice_folio</li>
                  )}
                </ul>
              </div>
            )}

            <Button
              variant="destructive"
              disabled={!targetStatus}
              onClick={() => { setConfirmText(''); setConfirmOpen(true); }}
              className="w-full"
            >
              <RefreshCw className="size-4 mr-2" />
              Forzar Cambio de Estado
            </Button>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" />
              Confirmar Cambio Forzado
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Cambiarás el estado de <strong>{service?.folio}</strong> a <strong>{SERVICE_STATUSES.find(s => s.value === targetStatus)?.label}</strong>.</p>
                <p className="font-medium">Esta acción puede causar inconsistencias si no se usa con cuidado.</p>
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
            <Button variant="destructive" disabled={confirmText !== expectedText || executing} onClick={handleForce}>
              {executing ? <Loader2 className="size-4 animate-spin mr-2" /> : <RefreshCw className="size-4 mr-2" />}
              Forzar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
