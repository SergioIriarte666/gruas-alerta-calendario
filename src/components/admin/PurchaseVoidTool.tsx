import { useState } from 'react';
import { Search, AlertTriangle, PackageX, Loader2, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import {
  useSearchVoidablePurchases,
  usePurchaseVoidImpact,
  useVoidPurchase,
  type VoidablePurchase,
} from '@/hooks/admin/usePurchaseVoid';
import { formatCurrency } from '@/lib/utils';

const formatDate = (d: string | null | undefined) => {
  if (!d) return '—';
  try {
    return new Date(`${d}T12:00:00Z`).toLocaleDateString('es-CL');
  } catch {
    return d;
  }
};

export const PurchaseVoidTool = () => {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<VoidablePurchase | null>(null);
  const [reason, setReason] = useState('');
  const [revertPayment, setRevertPayment] = useState(true);
  const [revertInvoice, setRevertInvoice] = useState(true);
  const [confirmText, setConfirmText] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const {
    data: results = [],
    isLoading: searching,
    error: searchError,
    isFetching: searchFetching,
  } = useSearchVoidablePurchases(search);
  const { data: impact, isLoading: loadingImpact } = usePurchaseVoidImpact(selected);
  const voidMutation = useVoidPurchase();

  const stockNegative =
    impact?.stockAfter !== null && impact?.stockAfter !== undefined && impact.stockAfter < 0;
  const canConfirm =
    reason.trim().length >= 5 && confirmText.trim().toUpperCase() === 'ANULAR' && !stockNegative;

  const handleConfirm = async () => {
    if (!selected) return;
    try {
      await voidMutation.mutateAsync({
        costId: selected.id,
        reason: reason.trim(),
        revertPayment,
        revertInvoice,
      });
      // Reset
      setSelected(null);
      setReason('');
      setConfirmText('');
      setConfirmOpen(false);
    } catch {
      // no-op: onError already handled it
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-l-4 border-l-primary/50">
        <CardHeader className="border-b border-border/70 bg-muted/20">
          <CardTitle className="flex items-center gap-2 text-primary">
            <PackageX className="size-5 text-primary" />
            Anular Compra de Bodega
          </CardTitle>
          <CardDescription>
            Revierte de forma segura una compra de bodega: elimina el costo, los movimientos de
            inventario, el pago al proveedor y la factura/XML vinculada. Pensado para compras
            devueltas, productos erróneos o duplicados.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por folio, descripción, proveedor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {(searching || searchFetching) && (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="size-5 animate-spin mr-2" />
              Buscando...
            </div>
          )}

          {!searching && !searchFetching && searchError && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertTitle>Error al buscar compras</AlertTitle>
              <AlertDescription>
                {(searchError as any)?.message || 'No se pudo consultar la base de datos.'}
              </AlertDescription>
            </Alert>
          )}

          {!searching && !searchFetching && !searchError && results.length === 0 && (
            <div className="text-center py-6 text-muted-foreground text-sm">
              {search.trim()
                ? `Sin resultados para "${search.trim()}".`
                : 'No se encontraron compras de bodega.'}
            </div>
          )}

          {!searching && results.length > 0 && (
            <div className="border rounded-md divide-y max-h-96 overflow-auto">
              {results.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelected(p)}
                  className={`w-full text-left p-3 hover:bg-muted/50 transition-colors ${
                    selected?.id === p.id ? 'bg-primary-soft' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {(p.document_number || p.service_folio) && (
                          <Badge variant="secondary" className="border-primary/20 bg-primary/10 font-mono text-xs text-primary">
                            #{p.document_number || p.service_folio}
                          </Badge>
                        )}
                        <span className="font-medium truncate">{p.description}</span>
                      </div>
                      {p.matched_item &&
                        p.matched_item.trim().toLowerCase() !==
                          (p.description || '').trim().toLowerCase() && (
                          <div className="mt-0.5 truncate text-xs text-primary">
                            Ítem: {p.matched_item}
                          </div>
                        )}
                      <div className="text-xs text-muted-foreground flex flex-wrap gap-2 mt-1">
                        <span>{formatDate(p.date)}</span>
                        <span>•</span>
                        <span>{p.supplier_name || 'Sin proveedor'}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-semibold text-primary">
                        {formatCurrency(p.amount)}
                      </div>
                      <div className="flex gap-1 justify-end mt-1">
                        {p.immediate_consumption && (
                          <Badge variant="outline" className="text-xs">Consumo</Badge>
                        )}
                        {p.payment_date && (
                          <Badge variant="outline" className="text-xs">Pagado</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selected && (
        <Card className="border-l-4 border-l-danger/50">
          <CardHeader className="border-b border-border/70 bg-muted/20">
            <CardTitle className="flex items-center gap-2 text-danger">
              <AlertTriangle className="size-5 text-danger" />
              Vista previa del impacto
            </CardTitle>
            <CardDescription>
              Revisa qué será eliminado. La acción es irreversible (queda registrada en auditoría).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingImpact && (
              <div className="flex items-center justify-center py-4 text-muted-foreground">
                <Loader2 className="size-4 animate-spin mr-2" />
                Calculando impacto...
              </div>
            )}

            {impact && (
              <>
                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  <div className="p-3 rounded-md border bg-muted/30">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1 flex items-center justify-between">
                      <span>Costo</span>
                      {(selected.document_number || selected.service_folio) && (
                        <span className="font-mono text-primary">
                          #{selected.document_number || selected.service_folio}
                        </span>
                      )}
                    </div>
                    <div className="font-medium">{selected.description}</div>
                    <div className="font-semibold text-primary">
                      {formatCurrency(selected.amount)}
                    </div>
                  </div>

                  <div className="p-3 rounded-md border bg-muted/30">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                      Movimientos de bodega
                    </div>
                    {impact.movements.length === 0 ? (
                      <div className="text-muted-foreground text-xs">Sin movimientos vinculados</div>
                    ) : (
                      <ul className="space-y-1">
                        {impact.movements.map((m) => (
                          <li key={m.id} className="flex items-center justify-between gap-2">
                            <span>
                              <Badge
                                variant={m.movement_type === 'entry' ? 'default' : 'secondary'}
                                className="mr-1 text-xs"
                              >
                                {m.movement_type === 'entry' ? 'Entrada' : 'Salida'}
                              </Badge>
                              {m.item_name || 'Producto'}
                            </span>
                            <span className="text-muted-foreground text-xs">
                              {m.quantity} u.
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="p-3 rounded-md border bg-muted/30">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                      Pago a proveedor
                    </div>
                    {impact.payment ? (
                      <>
                        <div className="font-medium">
                          {formatCurrency(impact.payment.amount)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {impact.payment.reference_number || 'Sin referencia'}
                        </div>
                      </>
                    ) : (
                      <div className="text-muted-foreground text-xs">Sin pago vinculado</div>
                    )}
                  </div>

                  <div className="p-3 rounded-md border bg-muted/30">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                      Factura / XML
                    </div>
                    {impact.invoice ? (
                      <>
                        <div className="font-medium">N° {impact.invoice.invoice_number}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatCurrency(impact.invoice.amount)} •{' '}
                          {formatDate(impact.invoice.issue_date)}
                        </div>
                      </>
                    ) : (
                      <div className="text-muted-foreground text-xs">Sin factura vinculada</div>
                    )}
                  </div>
                </div>

                {impact.currentStock !== null && (
                  <div
                    className={`p-3 rounded-md border text-sm flex items-center justify-between ${
                      stockNegative
                        ? 'border-danger/30 bg-danger/10'
                        : 'border-primary/30 bg-primary/10'
                    }`}
                  >
                    <span>
                      Stock actual: <strong>{impact.currentStock}</strong> → Stock después de
                      anular: <strong>{impact.stockAfter}</strong>
                    </span>
                    {stockNegative ? (
                      <Badge variant="destructive">Stock negativo</Badge>
                    ) : (
                      <CheckCircle2 className="size-4 text-primary" />
                    )}
                  </div>
                )}

                {stockNegative && (
                  <Alert variant="destructive">
                    <AlertTriangle className="size-4" />
                    <AlertTitle>No es posible anular</AlertTitle>
                    <AlertDescription>
                      El producto ya fue consumido por otros movimientos posteriores. Resuelve
                      manualmente esos consumos antes de anular esta compra.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-3 pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="revert-payment"
                      checked={revertPayment}
                      onCheckedChange={(c) => setRevertPayment(!!c)}
                      disabled={!impact.payment}
                    />
                    <Label htmlFor="revert-payment" className="text-sm cursor-pointer">
                      Eliminar también el pago al proveedor
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="revert-invoice"
                      checked={revertInvoice}
                      onCheckedChange={(c) => setRevertInvoice(!!c)}
                      disabled={!impact.invoice}
                    />
                    <Label htmlFor="revert-invoice" className="text-sm cursor-pointer">
                      Eliminar también la factura/XML vinculada
                    </Label>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="reason" className="text-sm">
                      Motivo de la anulación <span className="text-danger">*</span>
                    </Label>
                    <Textarea
                      id="reason"
                      placeholder="Ej: Producto incorrecto, devuelto al proveedor con reembolso en efectivo."
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={3}
                      className="resize-none"
                    />
                    <p className="text-xs text-muted-foreground">
                      Mínimo 5 caracteres. Quedará registrado en auditoría.
                    </p>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setSelected(null);
                        setReason('');
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={stockNegative || reason.trim().length < 5}
                      onClick={() => setConfirmOpen(true)}
                    >
                      <PackageX className="size-4 mr-2" />
                      Anular compra
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="border-border/70 bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-danger">
              <AlertTriangle className="size-5 text-danger" />
              Confirmación final
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <div>
                  Esta acción eliminará de forma irreversible la compra y todos sus rastros.
                  Para confirmar, escribe <strong>ANULAR</strong> a continuación.
                </div>
                <Input
                  placeholder="Escribe ANULAR"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  autoFocus
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmText('')}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!canConfirm || voidMutation.isPending}
              onClick={handleConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {voidMutation.isPending ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Anulando...
                </>
              ) : (
                'Confirmar anulación'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
