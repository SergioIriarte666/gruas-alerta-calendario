import * as React from 'react';
import { useState } from 'react';
import { Search, AlertTriangle, Trash2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';

interface ServiceDependencies {
  id: string;
  folio: string;
  status: string;
  value: number;
  clientName: string;
  costs: number;
  inspections: number;
  calendarEvents: number;
  closureLinks: number;
  invoiceLinks: number;
}

const statusLabels: Record<string, string> = {
  pending: 'Pendiente', in_progress: 'En progreso', completed: 'Completado',
  cancelled: 'Cancelado', invoiced: 'Facturado', with_purchase_order: 'Con OC',
  inspection_completed: 'Inspección completada', quoted: 'Cotizado',
  purchase_order_pending: 'OC Pendiente', failed: 'Fallido',
};

export const ServiceDeletionTool = () => {
  const [searchInput, setSearchInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [service, setService] = useState<ServiceDependencies | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    setSearching(true);
    setError(null);
    setService(null);

    try {
      const folio = searchInput.trim().toUpperCase();
      const { data: svc, error: svcErr } = await supabase
        .from('services')
        .select('id, folio, status, value, client:clients!services_client_id_fkey(name)')
        .eq('folio', folio)
        .maybeSingle();

      if (svcErr) throw svcErr;
      if (!svc) { setError(`No se encontró servicio con folio ${folio}`); return; }

      // Count dependencies in parallel
      const [costsRes, inspRes, calRes, closRes, invRes] = await Promise.all([
        supabase.from('costs').select('id', { count: 'exact', head: true }).eq('service_id', svc.id),
        supabase.from('inspections').select('id', { count: 'exact', head: true }).eq('service_id', svc.id),
        supabase.from('calendar_events').select('id', { count: 'exact', head: true }).eq('service_id', svc.id),
        supabase.from('closure_services').select('id', { count: 'exact', head: true }).eq('service_id', svc.id),
        supabase.from('invoice_services').select('id', { count: 'exact', head: true }).eq('service_id', svc.id),
      ]);

      const clientObj = svc.client as any;
      setService({
        id: svc.id,
        folio: svc.folio || folio,
        status: svc.status || 'unknown',
        value: svc.value || 0,
        clientName: clientObj?.name || 'Sin cliente',
        costs: costsRes.count || 0,
        inspections: inspRes.count || 0,
        calendarEvents: calRes.count || 0,
        closureLinks: closRes.count || 0,
        invoiceLinks: invRes.count || 0,
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSearching(false);
    }
  };

  const expectedText = service ? `ELIMINAR ${service.folio}` : '';

  const handleDelete = async () => {
    if (!service || confirmText !== expectedText) return;
    setDeleting(true);

    try {
      const { error } = await supabase.rpc('delete_service_cascade', { p_service_id: service.id });
      if (error) throw error;

      toast.success('Servicio eliminado', {
        description: `${service.folio} y todas sus dependencias han sido eliminados.`,
      });
      setConfirmOpen(false);
      setConfirmText('');
      setService(null);
      setSearchInput('');
    } catch (e: any) {
      toast.error('Error al eliminar', { description: e.message });
    } finally {
      setDeleting(false);
    }
  };

  const totalDeps = service
    ? service.costs + service.inspections + service.calendarEvents + service.closureLinks + service.invoiceLinks
    : 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Trash2 className="size-5 text-destructive" />
            Eliminación Segura de Servicio
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Elimina un servicio completo junto con todas sus dependencias (costos, inspecciones, etc.).
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
                <Badge className="bg-muted text-muted-foreground">
                  {statusLabels[service.status] || service.status}
                </Badge>
              </CardTitle>
              <span className="text-sm font-semibold">{formatCurrency(service.value)}</span>
            </div>
            <CardDescription>Cliente: <strong>{service.clientName}</strong></CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Dependency tree */}
            <div className="p-3 rounded-md border bg-muted/30 text-sm space-y-1">
              <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider mb-2">
                Dependencias ({totalDeps} registros relacionados)
              </h4>
              <div className="grid gap-1">
                <DepRow label="Costos" count={service.costs} />
                <DepRow label="Inspecciones" count={service.inspections} />
                <DepRow label="Eventos calendario" count={service.calendarEvents} />
                <DepRow label="Vínculos a cierres" count={service.closureLinks} />
                <DepRow label="Vínculos a facturas" count={service.invoiceLinks} />
              </div>
            </div>

            {service.invoiceLinks > 0 && (
              <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                <strong>⚠️ Atención:</strong> Este servicio está vinculado a una factura. Se eliminará la relación pero la factura permanecerá.
              </div>
            )}

            <Button
              variant="destructive"
              onClick={() => { setConfirmText(''); setConfirmOpen(true); }}
              className="w-full"
            >
              <Trash2 className="size-4 mr-2" />
              Eliminar Servicio Completo
            </Button>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" />
              Confirmar Eliminación Completa
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Se eliminará <strong>{service?.folio}</strong> y <strong>{totalDeps}</strong> registro(s) relacionados permanentemente.</p>
                <p className="font-medium text-destructive">Esta acción NO se puede deshacer.</p>
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
            <Button variant="destructive" disabled={confirmText !== expectedText || deleting} onClick={handleDelete}>
              {deleting ? <Loader2 className="size-4 animate-spin mr-2" /> : <Trash2 className="size-4 mr-2" />}
              Eliminar Permanentemente
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const DepRow = ({ label, count }: { label: string; count: number }) => (
  <div className="flex items-center justify-between py-1 px-2 rounded bg-muted/50 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <Badge variant={count > 0 ? 'destructive' : 'outline'} className="text-[10px]">
      {count}
    </Badge>
  </div>
);
