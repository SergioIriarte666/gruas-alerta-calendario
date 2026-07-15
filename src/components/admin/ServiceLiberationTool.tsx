import * as React from 'react';
import { useState } from 'react';
import { Search, AlertTriangle, FileText, Package, Trash2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { useServiceLiberation, LiberationSearchResult } from '@/hooks/useServiceLiberation';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';

const statusLabels: Record<string, string> = {
  draft: 'Borrador',
  sent: 'Enviada',
  paid: 'Pagada',
  overdue: 'Vencida',
  cancelled: 'Anulada',
  closed: 'Cerrado',
  invoiced: 'Facturado',
  with_purchase_order: 'Con OC',
  completed: 'Completado',
  pending: 'Pendiente',
  in_progress: 'En progreso',
};

const statusColor = (status: string) => {
  switch (status) {
    case 'paid': case 'completed': case 'closed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'invoiced': case 'sent': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 'overdue': case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    default: return 'bg-muted text-muted-foreground';
  }
};

export const ServiceLiberationTool = () => {
  const { isAdmin } = useUserPermissions();
  const {
    searching, liberating, result, error,
    searchByFolio, liberateInvoice, liberateClosure, clearResult: _clearResult,
  } = useServiceLiberation();

  const [searchInput, setSearchInput] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'invoice' | 'closure' | null>(null);
  const [confirmText, setConfirmText] = useState('');

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No tienes permisos para acceder a esta herramienta.
        </CardContent>
      </Card>
    );
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      searchByFolio(searchInput);
    }
  };

  const expectedConfirmText = result ? `LIBERAR ${result.folio}` : '';

  const handleConfirmLiberation = async () => {
    if (!result || confirmText !== expectedConfirmText) return;

    let res: { success: boolean; error?: string };

    if (confirmAction === 'invoice') {
      const serviceIds = result.services.map(s => s.id);
      const closureIds = result.linkedClosures.map(c => c.id);
      res = await liberateInvoice(result.id, serviceIds, closureIds);
    } else {
      const serviceIds = result.services.map(s => s.id);
      res = await liberateClosure(result.id, serviceIds);
    }

    setConfirmOpen(false);
    setConfirmText('');
    setConfirmAction(null);

    if (res.success) {
      toast.success('Liberación completada', {
        description: `${result.folio} ha sido liberado exitosamente. Los servicios están disponibles nuevamente.`,
      });
      setSearchInput('');
    } else {
      toast.error('Error al liberar', { description: res.error });
    }
  };

  const openConfirm = (action: 'invoice' | 'closure') => {
    setConfirmAction(action);
    setConfirmText('');
    setConfirmOpen(true);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
            <AlertTriangle className="size-5 text-destructive" />
            Herramienta de Liberación de Servicios
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Busca por folio de factura (FACT-XXXX) o cierre (CIE-XXX) para liberar servicios y permitir reprocesamiento.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Ej: FACT-4298 o CIE-339"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button type="submit" disabled={searching || !searchInput.trim()}>
              {searching ? <Loader2 className="size-4 animate-spin" /> : 'Buscar'}
            </Button>
          </form>

          {error && (
            <div className="mt-3 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {result && <ResultCard result={result} onLiberate={openConfirm} liberating={liberating} />}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" />
              Confirmar Liberación
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Esta acción eliminará <strong>{result?.folio}</strong> y liberará{' '}
                  <strong>{result?.services.length}</strong> servicio(s) para reprocesamiento.
                </p>
                <p className="font-medium">Esta acción no se puede deshacer.</p>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">
                    Escribe <span className="font-mono font-bold">{expectedConfirmText}</span> para confirmar:
                  </label>
                  <Input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder={expectedConfirmText}
                    className="font-mono"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={confirmText !== expectedConfirmText || liberating}
              onClick={handleConfirmLiberation}
            >
              {liberating ? <Loader2 className="size-4 animate-spin mr-2" /> : <Trash2 className="size-4 mr-2" />}
              Liberar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const ResultCard = ({
  result,
  onLiberate,
  liberating,
}: {
  result: LiberationSearchResult;
  onLiberate: (action: 'invoice' | 'closure') => void;
  liberating: boolean;
}) => {
  const icon = result.type === 'invoice' ? FileText : Package;
  const Icon = icon;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Icon className="size-5" />
            {result.folio}
            <Badge className={statusColor(result.status)}>
              {statusLabels[result.status] || result.status}
            </Badge>
          </CardTitle>
          <span className="text-sm font-semibold text-foreground">{formatCurrency(result.total)}</span>
        </div>
        <CardDescription className="text-sm">
          Cliente: <strong>{result.clientName}</strong>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Services */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Servicios asociados ({result.services.length})
          </h4>
          {result.services.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin servicios vinculados</p>
          ) : (
            <div className="grid gap-1">
              {result.services.map((svc) => (
                <div key={svc.id} className="flex items-center justify-between text-sm py-1 px-2 rounded bg-muted/50">
                  <span className="font-mono text-xs">{svc.folio}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{formatCurrency(svc.total)}</span>
                    <Badge variant="outline" className={`text-[10px] ${statusColor(svc.status)}`}>
                      {statusLabels[svc.status] || svc.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Linked closures (for invoices) */}
        {result.type === 'invoice' && result.linkedClosures.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Cierres vinculados ({result.linkedClosures.length})
            </h4>
            <div className="grid gap-1">
              {result.linkedClosures.map((cl) => (
                <div key={cl.id} className="flex items-center justify-between text-sm py-1 px-2 rounded bg-muted/50">
                  <span className="font-mono text-xs">{cl.folio}</span>
                  <Badge variant="outline" className={`text-[10px] ${statusColor(cl.status)}`}>
                    {statusLabels[cl.status] || cl.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Linked invoices (for closures) */}
        {result.type === 'closure' && result.linkedInvoices.length > 0 && (
          <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
            <strong>⚠️ Atención:</strong> Este cierre está vinculado a {result.linkedInvoices.length} factura(s):{' '}
            {result.linkedInvoices.map(i => i.folio).join(', ')}.
            Se recomienda liberar primero la factura.
          </div>
        )}

        {/* Impact preview */}
        <div className="p-3 rounded-md border bg-muted/30 text-sm space-y-1">
          <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider">Vista previa del impacto</h4>
          <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
            <li>{result.services.length} servicio(s) volverán a estado <Badge variant="outline" className="text-[10px] ml-1">Con OC</Badge></li>
            {result.type === 'invoice' && (
              <>
                <li>Se eliminarán relaciones en invoice_services e invoice_closures</li>
                <li>Se eliminará la factura {result.folio}</li>
                {result.linkedClosures.length > 0 && (
                  <li>
                    Se eliminará(n) {result.linkedClosures.length} cierre(s) vinculado(s):{' '}
                    <span className="font-mono">
                      {result.linkedClosures.map(c => c.folio).join(', ')}
                    </span>
                  </li>
                )}
              </>
            )}
            {result.type === 'closure' && (
              <>
                <li>Se eliminarán relaciones en closure_services</li>
                <li>Se eliminará el cierre {result.folio}</li>
              </>
            )}
          </ul>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="destructive"
            onClick={() => onLiberate(result.type)}
            disabled={liberating}
            className="flex-1"
          >
            {liberating ? <Loader2 className="size-4 animate-spin mr-2" /> : <Trash2 className="size-4 mr-2" />}
            Liberar {result.type === 'invoice' ? 'Factura' : 'Cierre'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
