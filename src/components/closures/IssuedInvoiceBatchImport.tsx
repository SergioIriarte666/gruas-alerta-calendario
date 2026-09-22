import { useEffect, useRef, useState } from 'react';
import {
  FileUp,
  Loader2,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useIssuedInvoiceImport } from '@/hooks/useIssuedInvoiceImport';
import {
  getIssuedInvoiceCandidates,
  INVOICE_PDF_BUCKET,
} from '@/utils/issuedInvoiceApi';
import {
  normalizeInvoiceOC,
  reconciliationErrors,
  suggestedInvoiceKeys,
  type InvoiceCandidate,
  type IssuedInvoiceDocument,
  type IssuedInvoiceDraft,
  type IssuedInvoiceFields,
} from '@/utils/issuedInvoiceImport';
import { supabase } from '@/integrations/supabase/client';

const money = (v: number) =>
  Number.isFinite(v) ? `$${v.toLocaleString('es-CL')}` : 'Sin leer';
const errorText = (e: unknown) =>
  (e as { message?: string })?.message || 'No se pudo completar la operación.';
const fieldLabels: [keyof IssuedInvoiceFields, string, string][] = [
  ['issuerRut', 'RUT emisor (tu empresa)', 'text'],
  ['clientRut', 'RUT receptor / pagador', 'text'],
  ['fiscalNumber', 'Folio fiscal del PDF', 'text'],
  ['purchaseOrder', 'Número de OC del PDF', 'text'],
  ['issueDate', 'Fecha de emisión', 'date'],
  ['dueDate', 'Fecha de vencimiento', 'date'],
  ['net', 'Neto / base exenta (CLP)', 'number'],
  ['vat', 'IVA del documento (CLP)', 'number'],
  ['total', 'Total del documento (CLP)', 'number'],
];
function InvoiceReview({
  doc,
  onClose,
  onSave,
  initialCandidates,
}: {
  doc: IssuedInvoiceDocument;
  initialCandidates: InvoiceCandidate[];
  onClose: () => void;
  onSave: (draft: IssuedInvoiceDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<IssuedInvoiceDraft>(() => ({
    ...doc.draft,
    fields: { ...doc.draft.fields },
  }));
  const [rows, setRows] = useState<InvoiceCandidate[]>(initialCandidates);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [url, setUrl] = useState('');
  const [allOC, setAllOC] = useState(false);
  const [search, setSearch] = useState('');
  const [loadedRut, setLoadedRut] = useState(
    initialCandidates.length ? doc.draft.fields.clientRut : '',
  );
  useEffect(() => {
    let active = true;
    supabase.storage
      .from(INVOICE_PDF_BUCKET)
      .createSignedUrl(doc.storage_path, 3600)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setError(error.message);
        else setUrl(data.signedUrl);
      });
    return () => {
      active = false;
    };
  }, [doc.storage_path]);
  const load = async () => {
    setBusy(true);
    setError('');
    try {
      const next = await getIssuedInvoiceCandidates(draft.fields.clientRut);
      setRows(next);
      setLoadedRut(draft.fields.clientRut);
      setDraft((d) => ({
        ...d,
        reviewed: false,
        selectedKeys: d.selectedKeys.length
          ? d.selectedKeys.filter((k) =>
              next.some((c) => c.key === k && !c.blocked),
            )
          : suggestedInvoiceKeys(d.fields, next),
      }));
    } catch (e) {
      setError(errorText(e));
      setRows([]);
      setLoadedRut('');
    } finally {
      setBusy(false);
    }
  };
  const changeField = (field: keyof IssuedInvoiceFields, value: string) => {
    setDraft((d) => ({
      ...d,
      reviewed: false,
      ...(field === 'dueDate' ? { dueDateDefaulted: false } : {}),
      selectedKeys:
        field === 'clientRut' || field === 'purchaseOrder'
          ? []
          : d.selectedKeys,
      fields: {
        ...d.fields,
        [field]: ['net', 'vat', 'total'].includes(field)
          ? value === ''
            ? NaN
            : Number(value)
          : value,
      },
    }));
    if (field === 'clientRut') {
      setRows([]);
      setLoadedRut('');
    }
  };
  const visible = rows.filter(
    (r) =>
      (allOC ||
        normalizeInvoiceOC(r.purchaseOrder) ===
          normalizeInvoiceOC(draft.fields.purchaseOrder)) &&
      `${r.folio} ${r.purchaseOrder} ${r.date}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const chosen = rows.filter((r) => draft.selectedKeys.includes(r.key));
  const errors = reconciliationErrors({ ...draft, reviewed: true }, rows);
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await onSave(draft);
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        className="finance-dialog max-w-[95vw] max-h-[94vh] overflow-y-auto sm:max-w-7xl"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Revisar factura · {doc.file_name}</DialogTitle>
          <DialogDescription>
            Compara el PDF, el RUT y la OC con los servicios de TMS. Guarda un
            borrador si faltan datos.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
          <div className="space-y-3">
            {url ? (
              <>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm underline"
                >
                  <ExternalLink className="size-4" />
                  Abrir PDF original
                </a>
                <iframe
                  src={url}
                  title={`PDF original ${doc.file_name}`}
                  className="h-[65vh] w-full rounded-xl border"
                />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Preparando vista del PDF…
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              El lector puede dejar campos vacíos si no logra identificarlos con
              certeza. Confírmalos en el documento original.
            </p>
          </div>
          <div className="space-y-4">
            <fieldset
              disabled={busy || !!doc.result}
              className="space-y-4 disabled:opacity-60"
            >
              <div>
                <Label htmlFor="invoice-type">Tipo de documento</Label>
                <select
                  id="invoice-type"
                  className="mt-1 w-full rounded-md border bg-background p-2"
                  value={draft.fields.documentType}
                  onChange={(e) => changeField('documentType', e.target.value)}
                >
                  <option value="">Seleccionar tipo del PDF</option>
                  <option value="33">33 · Factura electrónica</option>
                  <option value="34">34 · Factura exenta electrónica</option>
                </select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {fieldLabels.map(([key, label, type]) => (
                  <div key={key}>
                    <Label htmlFor={`import-${key}`}>{label}</Label>
                    <Input
                      id={`import-${key}`}
                      type={type}
                      min={type === 'number' ? 0 : undefined}
                      step={type === 'number' ? 1 : undefined}
                      value={
                        typeof draft.fields[key] === 'number' &&
                        !Number.isFinite(draft.fields[key])
                          ? ''
                          : (draft.fields[key] ?? '')
                      }
                      onChange={(e) => changeField(key, e.target.value)}
                    />
                  </div>
                ))}
              </div>
              <div>
                <Label htmlFor="import-description">
                  Descripción de la factura (10–500 caracteres)
                </Label>
                <Input
                  id="import-description"
                  maxLength={500}
                  value={draft.fields.description}
                  onChange={(e) => changeField('description', e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                onClick={load}
                disabled={!draft.fields.clientRut || busy}
              >
                <RefreshCw className="mr-2 size-4" />
                Buscar servicios por RUT y OC
              </Button>
              <p className="text-xs text-muted-foreground">
                Se sugieren los servicios de la OC únicamente si su suma
                coincide. Revisa la asignación cuando una OC abarque varias
                facturas.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={allOC}
                    onChange={(e) => setAllOC(e.target.checked)}
                  />
                  Ver otras OC del mismo cliente
                </label>
                <Input
                  aria-label="Buscar servicio, OC o fecha"
                  placeholder="Buscar servicio, OC o fecha…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="sm:max-w-64"
                />
              </div>
              <div className="max-h-72 overflow-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="p-2">Elegir</th>
                      <th className="p-2 text-left">Servicio / OC en TMS</th>
                      <th className="p-2">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((r) => (
                      <tr key={r.key} className="border-t">
                        <td className="p-2 text-center">
                          <input
                            aria-label={`Seleccionar ${r.folio} ${r.valueType}`}
                            type="checkbox"
                            disabled={!!r.blocked}
                            checked={draft.selectedKeys.includes(r.key)}
                            onChange={(e) =>
                              setDraft((d) => ({
                                ...d,
                                reviewed: false,
                                selectedKeys: e.target.checked
                                  ? [...d.selectedKeys, r.key]
                                  : d.selectedKeys.filter((k) => k !== r.key),
                              }))
                            }
                          />
                        </td>
                        <td className="p-2">
                          <strong>{r.folio}</strong> ·{' '}
                          {r.valueType === 'excess' ? 'Excedente' : 'Cubierto'}
                          <div className="text-xs text-muted-foreground">
                            {r.date} · OC: {r.purchaseOrder || 'Sin OC'}
                            {r.closureFolio && ` · Cierre ${r.closureFolio}`}
                          </div>
                          {r.blocked && (
                            <div className="text-xs text-destructive">
                              {r.blocked}
                            </div>
                          )}
                        </td>
                        <td className="p-2 text-right">{money(r.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!visible.length && (
                  <p className="p-4 text-sm text-muted-foreground">
                    {loadedRut
                      ? 'Sin servicios para este filtro. Puedes revisar otras OC del mismo cliente.'
                      : 'Busca los servicios después de confirmar el RUT y la OC.'}
                  </p>
                )}
              </div>
              <div className="flex justify-between rounded-lg bg-muted p-3 text-sm">
                <span>{chosen.length} conceptos seleccionados</span>
                <strong>
                  Diferencia:{' '}
                  {money(
                    draft.fields.net - chosen.reduce((n, r) => n + r.amount, 0),
                  )}
                </strong>
              </div>
              <div>
                <Label htmlFor="manual-reason">
                  Motivo de asignación manual (si falta OC o es distinta)
                </Label>
                <Input
                  id="manual-reason"
                  value={draft.manualReason}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      manualReason: e.target.value,
                      reviewed: false,
                    }))
                  }
                  placeholder="Explica la referencia comprobada en el PDF"
                />
              </div>
            </fieldset>
            {!doc.result && errors.length > 0 && (
              <ul className="space-y-1 text-xs text-muted-foreground">
                {errors.map((e) => (
                  <li key={e}>• {e}</li>
                ))}
              </ul>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose} disabled={busy}>
                Cancelar
              </Button>
              {!doc.result && (
                <Button onClick={save} disabled={busy}>
                  {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
                  {errors.length ? 'Guardar pendientes' : 'Aplicar corrección'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function IssuedInvoiceBatchImport() {
  const batch = useIssuedInvoiceImport();
  const { isAdmin } = useUserPermissions();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<IssuedInvoiceDocument | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const readyIds = new Set(batch.ready.map((d) => d.id));
  const selected = batch.ready.filter((d) => batch.selected.has(d.id));
  const pending = batch.documents.filter(
    (d) => !d.result && !readyIds.has(d.id),
  );
  const completed = batch.documents.filter((d) => d.result).length;
  const allCompleted =
    batch.documents.length > 0 && completed === batch.documents.length;
  const close = () => {
    if (batch.busy) return;
    setOpen(false);
    setEditing(null);
    batch.reset();
  };
  if (!isAdmin) return null;
  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          batch.reset();
          setOpen(true);
        }}
      >
        <FileUp className="mr-2 size-4" />
        Cierres desde facturas PDF
      </Button>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) close();
          else setOpen(true);
        }}
      >
        <DialogContent
          className="finance-dialog max-w-[95vw] max-h-[92vh] overflow-y-auto sm:max-w-5xl"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Crear cierres desde facturas</DialogTitle>
            <DialogDescription>
              Sube tus facturas. Leeremos la OC y buscaremos sus servicios para
              crear el cierre y registrar cada factura en TMS.
            </DialogDescription>
          </DialogHeader>
          {batch.processedNotices.length > 0 && (
            <Alert
              role="status"
              className="border-amber-300 bg-amber-50 text-amber-950"
            >
              <AlertDescription>
                {batch.processedNotices.map((notice, index) => (
                  <p key={index} className="font-semibold">
                    {notice}
                  </p>
                ))}
              </AlertDescription>
            </Alert>
          )}
          {completed > 0 && (
            <Alert
              role="status"
              className="border-green-200 bg-green-50 text-green-900"
            >
              <CheckCircle2 className="size-4" />
              <AlertDescription>
                <div className="space-y-2">
                  {batch.documents
                    .filter((d) => d.result)
                    .map((d) => (
                      <div key={d.id}>
                        <p className="font-semibold">
                          La factura{' '}
                          {d.draft.fields.fiscalNumber || d.file_name} ya fue
                          procesada.
                        </p>
                        <p>
                          {d.result!.closureFolios.join(', ')} ·{' '}
                          {d.result!.invoiceFolio}. No es necesario volver a
                          procesarla.
                        </p>
                      </div>
                    ))}
                </div>
              </AlertDescription>
            </Alert>
          )}
          {batch.error && (
            <Alert variant="destructive">
              <AlertDescription>{batch.error}</AlertDescription>
            </Alert>
          )}
          {batch.fileErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertDescription>
                {batch.fileErrors.map((e) => (
                  <p key={e}>{e}</p>
                ))}
              </AlertDescription>
            </Alert>
          )}
          <div
            className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-dashed bg-muted/20 p-6"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (!batch.busy)
                void batch.upload(Array.from(e.dataTransfer.files));
            }}
          >
            <div>
              <p className="font-medium">Arrastra las facturas PDF aquí</p>
              <p className="mt-1 text-sm text-muted-foreground">
                OC → servicios → cierre y factura
              </p>
            </div>
            <input
              ref={input}
              type="file"
              accept="application/pdf,.pdf"
              multiple
              className="hidden"
              aria-label="Seleccionar facturas PDF"
              onChange={(e) => {
                if (e.target.files)
                  void batch.upload(Array.from(e.target.files));
                e.target.value = '';
              }}
            />
            <Button
              disabled={!!batch.busy}
              onClick={() => input.current?.click()}
            >
              <FileUp className="mr-2 size-4" />
              Seleccionar PDF
            </Button>
          </div>
          {batch.busy && (
            <p role="status" className="flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" />
              {batch.busy}
            </p>
          )}
          {batch.documents.length > 0 && (
            <div className="overflow-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left">
                  <tr>
                    <th className="p-3">
                      <input
                        type="checkbox"
                        aria-label="Seleccionar todas las coincidencias"
                        disabled={!!batch.busy || !batch.ready.length}
                        checked={
                          !!batch.ready.length &&
                          selected.length === batch.ready.length
                        }
                        onChange={(e) =>
                          batch.setSelected(
                            e.target.checked
                              ? new Set(batch.ready.map((d) => d.id))
                              : new Set(),
                          )
                        }
                      />
                    </th>
                    <th className="p-3">Factura</th>
                    <th className="p-3">OC leída</th>
                    <th className="p-3">Servicios del cierre</th>
                    <th className="p-3">Total factura</th>
                    <th className="p-3">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {batch.documents.map((d) => {
                    const rows = (batch.candidates[d.id] || []).filter((c) =>
                      d.draft.selectedKeys.includes(c.key),
                    );
                    return (
                      <tr key={d.id} className="border-t align-top">
                        <td className="p-3">
                          <input
                            type="checkbox"
                            aria-label={`Incluir factura ${d.draft.fields.fiscalNumber || d.file_name}`}
                            disabled={!!batch.busy || !readyIds.has(d.id)}
                            checked={
                              batch.selected.has(d.id) && readyIds.has(d.id)
                            }
                            onChange={(e) =>
                              batch.setSelected((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(d.id);
                                else next.delete(d.id);
                                return next;
                              })
                            }
                          />
                        </td>
                        <td className="p-3">
                          <strong>
                            {d.draft.fields.fiscalNumber || 'Sin leer'}
                          </strong>
                          <p className="text-xs text-muted-foreground">
                            {d.file_name}
                          </p>
                        </td>
                        <td className="p-3 font-medium">
                          {d.draft.fields.purchaseOrder || 'Sin identificar'}
                        </td>
                        <td className="p-3">
                          <details>
                            <summary className="cursor-pointer">
                              {rows.length === 1
                                ? rows[0].folio
                                : `${d.result ? d.draft.selectedKeys.length : rows.length} servicios`}{' '}
                              ·{' '}
                              {money(
                                d.result
                                  ? d.draft.fields.net
                                  : rows.reduce((sum, c) => sum + c.amount, 0),
                              )}{' '}
                              neto
                            </summary>
                            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                              {rows.map((c) => (
                                <li key={c.key}>
                                  {c.folio} · OC {c.purchaseOrder} ·{' '}
                                  {money(c.amount)}
                                  {c.valueType === 'excess'
                                    ? ' (excedente)'
                                    : ''}
                                </li>
                              ))}
                            </ul>
                            <p className="mt-2 text-xs text-muted-foreground">
                              RUT: {d.draft.fields.clientRut || 'Sin leer'}
                              <br />
                              Emisión: {d.draft.fields.issueDate || 'Sin leer'}
                              <br />
                              Vencimiento:{' '}
                              {d.draft.fields.dueDate || 'Sin leer'}
                              {d.draft.dueDateDefaulted
                                ? ' (30 días, valor habitual)'
                                : ''}
                            </p>
                            <Button
                              size="sm"
                              variant="link"
                              disabled={!!batch.busy}
                              onClick={() => setEditing(d)}
                            >
                              {d.result
                                ? 'Ver PDF y datos'
                                : 'Ver PDF / corregir datos'}
                            </Button>
                          </details>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {money(d.draft.fields.total)}
                        </td>
                        <td className="p-3">
                          <Badge
                            variant={readyIds.has(d.id) ? 'default' : 'outline'}
                          >
                            {d.result
                              ? 'Ya procesada'
                              : readyIds.has(d.id)
                                ? 'Listo para crear'
                                : 'Revisar'}
                          </Badge>
                          {d.result ? (
                            <p className="mt-2 text-xs">
                              {d.result.closureFolios.join(', ')} ·{' '}
                              {d.result.invoiceFolio}
                            </p>
                          ) : (
                            !readyIds.has(d.id) && (
                              <>
                                <p className="mt-2 max-w-52 text-xs text-muted-foreground">
                                  {batch.issues[d.id]?.[0]}
                                </p>
                                <Button
                                  variant="link"
                                  size="sm"
                                  disabled={!!batch.busy}
                                  onClick={() => setEditing(d)}
                                >
                                  Resolver
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={!!batch.busy}
                                  onClick={() => batch.removeFromView(d.id)}
                                >
                                  Omitir
                                </Button>
                              </>
                            )
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {pending.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {pending.length} factura(s) requieren resolver una diferencia.
              Puedes continuar con las que coinciden.
            </p>
          )}
          {batch.documents.some(
            (d) => d.draft.dueDateDefaulted && !d.result,
          ) && (
            <p className="text-xs text-muted-foreground">
              Si el PDF no indica vencimiento, se propone emisión + 30 días,
              como valor habitual de la creación de facturas. Puedes cambiarlo
              en el detalle.
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            {!allCompleted && (
              <Button
                variant="ghost"
                size="sm"
                disabled={!!batch.busy}
                onClick={() =>
                  void (batch.documents.length ? batch.retry() : batch.load())
                }
              >
                <RefreshCw className="mr-2 size-4" />
                {batch.documents.length
                  ? 'Volver a comprobar'
                  : 'Retomar pendientes'}
              </Button>
            )}
            <div className="ml-auto flex gap-3">
              <Button
                variant={allCompleted ? 'default' : 'outline'}
                disabled={!!batch.busy}
                onClick={close}
              >
                {allCompleted ? 'Finalizar' : 'Cerrar'}
              </Button>
              {!allCompleted && (
                <Button
                  disabled={!selected.length || !!batch.busy}
                  onClick={() => void batch.run()}
                >
                  Crear cierres y registrar {selected.length || ''}{' '}
                  {selected.length === 1 ? 'factura' : 'facturas'}
                </Button>
              )}
            </div>
          </div>
          {!allCompleted && (
            <p className="text-xs text-muted-foreground">
              El botón confirma los servicios propuestos. Se conserva el folio
              SII original y la factura se registra sin marcarla pagada.
            </p>
          )}
        </DialogContent>
      </Dialog>
      {editing && (
        <InvoiceReview
          key={editing.id}
          doc={editing}
          initialCandidates={batch.candidates[editing.id] || []}
          onClose={() => setEditing(null)}
          onSave={(draft) => batch.save(editing, draft)}
        />
      )}
    </>
  );
}
