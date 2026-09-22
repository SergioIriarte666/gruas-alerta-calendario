import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FileUp,
  Loader2,
  RefreshCw,
  Download,
  ExternalLink,
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
}: {
  doc: IssuedInvoiceDocument;
  onClose: () => void;
  onSave: (draft: IssuedInvoiceDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<IssuedInvoiceDraft>(() => ({
    ...doc.draft,
    fields: { ...doc.draft.fields },
  }));
  const [rows, setRows] = useState<InvoiceCandidate[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [url, setUrl] = useState('');
  const [allOC, setAllOC] = useState(false);
  const [search, setSearch] = useState('');
  const [loadedRut, setLoadedRut] = useState('');
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
  const errors = reconciliationErrors(draft, rows);
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
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={draft.reviewed}
                  disabled={
                    !loadedRut ||
                    !!reconciliationErrors({ ...draft, reviewed: true }, rows)
                      .length
                  }
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, reviewed: e.target.checked }))
                  }
                />
                Revisé el PDF, sus datos, OC, servicios y montos. Confirmo esta
                asignación.
              </label>
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
                  {errors.length ? 'Guardar borrador' : 'Guardar revisión'}
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
  const [confirm, setConfirm] = useState(false);
  const [filter, setFilter] = useState('all');
  const input = useRef<HTMLInputElement>(null);
  const readyIds = new Set(batch.ready.map((d) => d.id));
  const selected = batch.ready.filter((d) => batch.selected.has(d.id));
  const total = selected.reduce((n, d) => n + d.draft.fields.total, 0);
  const shown = batch.documents.filter(
    (d) =>
      filter === 'all' ||
      (filter === 'done'
        ? !!d.result
        : filter === 'ready'
          ? readyIds.has(d.id)
          : !d.result && !readyIds.has(d.id)),
  );
  const closureSummary = useMemo(() => {
    let fresh = 0;
    const reused = new Set<string>();
    selected.forEach((d) => {
      const rows = (batch.candidates[d.id] || []).filter((c) =>
        d.draft.selectedKeys.includes(c.key),
      );
      fresh += new Set(rows.filter((c) => !c.closureId).map((c) => c.valueType))
        .size;
      rows.forEach((c) => {
        if (c.closureId) reused.add(c.closureId);
      });
    });
    return { fresh, reused: reused.size };
  }, [selected, batch.candidates]);
  const exportResults = () => {
    const quote = (v: string) =>
      `"${v.replace(/^[=+@-]/, "'$&").replace(/"/g, '""')}"`;
    const rows = [
      ['Archivo', 'Folio fiscal', 'Factura TMS', 'Cierres', 'Resultado'],
      ...batch.documents.map((d) => [
        d.file_name,
        d.draft.fields.fiscalNumber,
        d.result?.invoiceFolio || '',
        d.result?.closureFolios.join(', ') || '',
        d.result ? 'Registrada' : batch.issues[d.id]?.join(' / ') || 'Lista',
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob(
        ['\ufeff' + rows.map((r) => r.map(quote).join(';')).join('\r\n')],
        { type: 'text/csv;charset=utf-8' },
      ),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'resultado-importacion-facturas.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  if (!isAdmin) return null;
  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setOpen(true);
          void batch.load();
        }}
      >
        <FileUp className="mr-2 size-4" />
        Importar facturas emitidas
      </Button>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!batch.busy) setOpen(v);
        }}
      >
        <DialogContent
          className="finance-dialog max-w-[95vw] max-h-[92vh] overflow-y-auto sm:max-w-7xl"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Cierres y facturación por lotes</DialogTitle>
            <DialogDescription>
              Carga PDF ya emitidos en el SII. Revisa RUT + OC, servicios y
              montos antes de registrar en TMS.
            </DialogDescription>
          </DialogHeader>
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
          {batch.busy && (
            <p role="status" className="flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" />
              {batch.busy}
            </p>
          )}
          <div
            className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed p-4"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (!batch.busy) {
                setConfirm(false);
                void batch.upload(Array.from(e.dataTransfer.files));
              }
            }}
          >
            <input
              ref={input}
              type="file"
              accept="application/pdf,.pdf"
              multiple
              className="hidden"
              aria-label="Agregar facturas PDF"
              onChange={(e) => {
                if (e.target.files) {
                  setConfirm(false);
                  void batch.upload(Array.from(e.target.files));
                }
                e.target.value = '';
              }}
            />
            <Button
              onClick={() => input.current?.click()}
              disabled={!!batch.busy}
            >
              <FileUp className="mr-2 size-4" />
              Agregar PDF
            </Button>
            <span className="text-sm text-muted-foreground">
              o arrástralos aquí · 20 MB / 30 páginas por documento
            </span>
            <Button
              variant="outline"
              disabled={!!batch.busy}
              onClick={() => {
                setConfirm(false);
                void batch.retry();
              }}
            >
              <RefreshCw className="mr-2 size-4" />
              Revalidar / reintentar
            </Button>
            <Button
              variant="outline"
              disabled={!batch.documents.length || !!batch.busy}
              onClick={exportResults}
            >
              <Download className="mr-2 size-4" />
              Resultados
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              ['all', 'Todas'],
              ['ready', 'Listas'],
              ['review', 'Revisar'],
              ['done', 'Registradas'],
            ].map(([v, label]) => (
              <Button
                key={v}
                variant={filter === v ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter(v)}
              >
                {label}
              </Button>
            ))}
          </div>
          <div className="grid items-start gap-4 xl:grid-cols-[1fr_270px]">
            <div className="min-w-0 overflow-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left">
                  <tr>
                    <th className="p-3">
                      <input
                        aria-label="Seleccionar todas las listas"
                        type="checkbox"
                        disabled={!!batch.busy || !batch.ready.length}
                        checked={
                          !!batch.ready.length &&
                          selected.length === batch.ready.length
                        }
                        onChange={(e) => {
                          setConfirm(false);
                          batch.setSelected(
                            e.target.checked
                              ? new Set(batch.ready.map((d) => d.id))
                              : new Set(),
                          );
                        }}
                      />
                    </th>
                    <th className="p-3">Documento / OC PDF</th>
                    <th className="p-3">Neto / total</th>
                    <th className="p-3">Estado</th>
                    <th className="p-3">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((d) => (
                    <tr key={d.id} className="border-t align-top">
                      <td className="p-3">
                        <input
                          aria-label={`Seleccionar ${d.file_name}`}
                          type="checkbox"
                          disabled={!!batch.busy || !readyIds.has(d.id)}
                          checked={
                            batch.selected.has(d.id) && readyIds.has(d.id)
                          }
                          onChange={(e) => {
                            setConfirm(false);
                            batch.setSelected((s) => {
                              const n = new Set(s);
                              if (e.target.checked) n.add(d.id);
                              else n.delete(d.id);
                              return n;
                            });
                          }}
                        />
                      </td>
                      <td className="p-3">
                        <strong>{d.file_name}</strong>
                        <div className="text-xs text-muted-foreground">
                          Folio SII: {d.draft.fields.fiscalNumber || 'Revisar'}
                          <br />
                          RUT: {d.draft.fields.clientRut || 'Revisar'}
                          <br />
                          OC PDF: {d.draft.fields.purchaseOrder || 'Sin leer'}
                          <br />
                          OC TMS:{' '}
                          {[
                            ...new Set(
                              (batch.candidates[d.id] || [])
                                .filter((c) =>
                                  d.draft.selectedKeys.includes(c.key),
                                )
                                .map((c) => c.purchaseOrder || 'Sin OC'),
                            ),
                          ].join(', ') || 'Sin asignar'}
                        </div>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {money(d.draft.fields.net)}
                        <div className="text-xs text-muted-foreground">
                          Total {money(d.draft.fields.total)}
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge
                          variant={
                            d.result
                              ? 'secondary'
                              : readyIds.has(d.id)
                                ? 'default'
                                : 'outline'
                          }
                        >
                          {d.result
                            ? 'Registrada'
                            : readyIds.has(d.id)
                              ? 'Lista'
                              : 'Revisar'}
                        </Badge>
                        <div className="mt-2 max-w-64 text-xs text-muted-foreground">
                          {d.result
                            ? `${d.result.invoiceFolio} · ${d.result.closureFolios.join(', ')}`
                            : batch.issues[d.id]?.[0]}
                        </div>
                      </td>
                      <td className="p-3">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!!batch.busy}
                          onClick={() => {
                            setConfirm(false);
                            setEditing(d);
                          }}
                        >
                          {d.result ? 'Ver PDF' : 'Revisar'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!!batch.busy}
                          onClick={() => {
                            setConfirm(false);
                            batch.removeFromView(d.id);
                          }}
                        >
                          Quitar del lote
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!shown.length && (
                <p className="p-8 text-center text-muted-foreground">
                  Agrega PDF o recupera tus borradores pendientes al abrir esta
                  ventana.
                </p>
              )}
            </div>
            <aside className="space-y-4 rounded-xl border bg-muted/20 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Resumen del lote
              </p>
              <p className="text-4xl font-semibold">{selected.length}</p>
              <p className="text-sm">facturas seleccionadas</p>
              <div className="text-sm">
                {closureSummary.fresh} cierres nuevos
                <br />
                {closureSummary.reused} cierres existentes
              </div>
              <p className="text-2xl font-semibold">{money(total)}</p>
              <p className="text-xs text-muted-foreground">
                Total de las facturas seleccionadas. El registro no implica pago
                ni genera una emisión nueva en SII.
              </p>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  disabled={!selected.length || !!batch.busy}
                  checked={confirm}
                  onChange={(e) => setConfirm(e.target.checked)}
                />
                Confirmo registrar estas facturas y sus cierres en TMS.
              </label>
              <Button
                className="w-full"
                disabled={!confirm || !selected.length || !!batch.busy}
                onClick={() => {
                  setConfirm(false);
                  void batch.run();
                }}
              >
                Crear cierres y registrar
              </Button>
              <p className="text-xs text-muted-foreground">
                Los borradores y resultados se guardan. Cada factura se procesa
                completa; puedes reintentar las que fallen.
              </p>
            </aside>
          </div>
        </DialogContent>
      </Dialog>
      {editing && (
        <InvoiceReview
          key={editing.id}
          doc={editing}
          onClose={() => setEditing(null)}
          onSave={(draft) => batch.save(editing, draft)}
        />
      )}
    </>
  );
}
