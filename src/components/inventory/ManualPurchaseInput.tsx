import type { useXmlInventoryUpload } from '@/hooks/xml/useXmlInventoryUpload';
import { emptyPurchaseLine, manualPurchaseTotals, validateManualPurchase } from '@/utils/manualPurchase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import DatePickerInput from '@/components/common/DatePickerInput';
import { Camera, Loader2, Plus, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/utils/xml/xmlInventoryHelpers';
import { Checkbox } from '@/components/ui/checkbox';

type ManualInputState = Pick<ReturnType<typeof useXmlInventoryUpload>, 'manual' | 'manualPrepared' | 'prepareManualPurchase' | 'editManualPurchase' | 'isImporting'>;

export function ManualPurchaseInput({ upload, allowNoDetails = false }: { upload: ManualInputState; allowNoDetails?: boolean }) {
  const { manual, manualPrepared, prepareManualPurchase, editManualPurchase, isImporting } = upload;
  const { draft, setDraft, photo, photoUrl, photoBusy, extracting, photoError, choosePhoto, readPhoto, removePhoto } = manual;
  const busy = isImporting || photoBusy || extracting;
  const totals = manualPurchaseTotals(draft);
  const error = validateManualPurchase(draft, allowNoDetails);
  const setField = (field: keyof Omit<typeof draft, 'lines'>, value: string) => setDraft({ ...draft, [field]: value });
  if (manualPrepared) return <Card><CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
    <div><p className="font-semibold">Factura {draft.folio} · {draft.supplierName}</p><p className="text-sm text-muted-foreground">{draft.lines.length ? `${draft.lines.length} productos` : 'Sin detalle de productos'} · {photo ? 'Foto de respaldo incluida' : 'Ingreso manual sin foto'} · {formatCurrency(Number(draft.total))}</p></div>
    <Button type="button" variant="outline" disabled={busy} onClick={editManualPurchase}>Editar datos de la factura</Button>
  </CardContent></Card>;
  return <Card className="overflow-hidden">
    <CardHeader className="border-b bg-muted/20"><CardTitle className="flex items-center gap-2 text-base"><Camera className="size-4 text-primary" />Compra desde foto o ingreso manual</CardTitle></CardHeader>
    <CardContent className="space-y-5 pt-4">
      <Alert><AlertDescription>La lectura de la foto solo precarga datos. Verifica los campos y los precios netos; no se registra ninguna compra hasta la confirmación final. El pago se elige por separado.</AlertDescription></Alert>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="space-y-3 rounded-xl border bg-muted/10 p-3">
          <Label htmlFor="manual-photo">Foto de la factura (opcional)</Label>
          <Input id="manual-photo" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" disabled={busy} onChange={event => { const file = event.target.files?.[0]; if (file) void choosePhoto(file); event.target.value = ''; }} />
          <p className="text-xs text-muted-foreground">JPG, PNG, WEBP o HEIC, hasta 20 MB. Se guarda una copia JPEG legible como respaldo.</p>
          {photoUrl && <a href={photoUrl} target="_blank" rel="noreferrer"><img src={photoUrl} alt="Foto de respaldo de la compra" className="max-h-64 w-full rounded-lg border object-contain" /></a>}
          {photo && <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={removePhoto}>Quitar foto y conservar los datos</Button>}
          <Button type="button" variant="outline" className="w-full" disabled={!photo || busy} onClick={() => void readPhoto()}>{busy && <Loader2 className="mr-2 size-4 animate-spin" />}{extracting ? 'Leyendo factura…' : photoBusy ? 'Preparando foto…' : 'Leer foto y precargar datos'}</Button>
          {photoError && <p role="alert" className="text-sm text-destructive">{photoError}</p>}
          <p className="text-xs text-muted-foreground">La foto se envía al servicio de lectura de la app al pulsar Leer foto. Volver a leer reemplaza los datos escritos. También puedes completar todo manualmente.</p>
        </div>
        <fieldset disabled={busy} className="grid min-w-0 content-start gap-3 sm:grid-cols-2">
          {([['supplierName', 'Proveedor'], ['supplierRut', 'RUT del proveedor'], ['folio', 'Folio de factura']] as const).map(([field, label]) => <div key={field} className="space-y-1"><Label htmlFor={`manual-${field}`}>{label} *</Label><Input id={`manual-${field}`} value={draft[field]} onChange={event => setField(field, event.target.value)} maxLength={field === 'supplierName' ? 200 : 25} /></div>)}
          <div className="space-y-1"><Label htmlFor="manual-issue-date">Fecha de emisión *</Label><DatePickerInput id="manual-issue-date" disabled={busy} value={draft.issueDate} onChange={value => setField('issueDate', value)} /></div>
          <div className="space-y-1"><Label htmlFor="manual-due-date">Vencimiento del comprobante</Label><DatePickerInput id="manual-due-date" disabled={busy} value={draft.dueDate} onChange={value => setField('dueDate', value)} /><p className="text-xs text-muted-foreground">Si no lo indicas, se usará la fecha de emisión. Podrás ajustarlo en Costo y pago.</p></div>
        </fieldset>
      </div>
      {allowNoDetails && <div className="space-y-2 rounded-xl border p-3"><Label className="flex items-center gap-2"><Checkbox checked={!draft.lines.length} disabled={busy} onCheckedChange={checked => setDraft({ ...draft, lines: checked ? [] : [emptyPurchaseLine()] })} />Registrar solo los totales: no tengo detalle legible</Label><p className="text-xs text-muted-foreground">No se inventarán productos. Al activar esta opción se quitan las líneas precargadas; clasifica el gasto completo en el siguiente paso.</p></div>}
      {draft.lines.length > 0 && <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-medium">Productos del comprobante</h3><Button type="button" variant="outline" size="sm" disabled={busy || draft.lines.length >= 100} onClick={() => setDraft({ ...draft, lines: [...draft.lines, emptyPurchaseLine()] })}><Plus className="mr-1 size-4" />Agregar producto</Button></div>
        {draft.lines.map((line, index) => {
          const update = (field: keyof typeof line, value: string) => setDraft({ ...draft, lines: draft.lines.map(item => item.id === line.id ? { ...item, [field]: value } : item) });
          return <fieldset key={line.id} disabled={busy} className="grid min-w-0 gap-3 rounded-xl border bg-muted/10 p-3 sm:grid-cols-2 lg:grid-cols-[1fr_3fr_0.7fr_1.2fr_1fr_auto]">
            <div className="space-y-1"><Label htmlFor={`manual-code-${line.id}`}>Código</Label><Input id={`manual-code-${line.id}`} value={line.code} onChange={event => update('code', event.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor={`manual-description-${line.id}`}>Producto {index + 1} *</Label><Input id={`manual-description-${line.id}`} value={line.description} onChange={event => update('description', event.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor={`manual-quantity-${line.id}`}>Cantidad *</Label><Input id={`manual-quantity-${line.id}`} type="number" min="1" step="1" value={line.quantity} onChange={event => update('quantity', event.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor={`manual-price-${line.id}`}>Precio unit. neto *</Label><Input id={`manual-price-${line.id}`} type="number" min="0" step="0.01" value={line.unitPrice} onChange={event => update('unitPrice', event.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor={`manual-tax-${line.id}`}>IVA</Label><Select value={line.taxRate} disabled={busy} onValueChange={value => update('taxRate', value)}><SelectTrigger id={`manual-tax-${line.id}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="19">19%</SelectItem><SelectItem value="0">Exento</SelectItem></SelectContent></Select></div>
            <Button type="button" variant="ghost" size="icon" className="self-end" aria-label={`Eliminar producto ${index + 1}`} disabled={busy || draft.lines.length === 1} onClick={() => setDraft({ ...draft, lines: draft.lines.filter(item => item.id !== line.id) })}><Trash2 className="size-4" /></Button>
          </fieldset>;
        })}
      </div>}
      <div className="grid gap-3 rounded-xl border p-3 sm:grid-cols-3">
        {([['net', 'Neto del comprobante'], ['vat', 'IVA del comprobante'], ['total', 'Total del comprobante']] as const).map(([field, label]) => <div key={field} className="space-y-1"><Label htmlFor={`manual-${field}`}>{label} *</Label><Input id={`manual-${field}`} type="number" min="0" value={draft[field]} disabled={busy} onChange={event => setField(field, event.target.value)} /></div>)}
        <p className="text-xs text-muted-foreground sm:col-span-3">{draft.lines.length ? <>Cálculo: cantidad × precio unitario neto, no la columna Total de la foto. Neto {formatCurrency(totals.net)} · IVA {formatCurrency(totals.vat)} · total {formatCurrency(totals.total)}.</> : 'Sin detalle: comprueba que neto + IVA coincidan con el total.'} Compara con el impreso antes de continuar.</p>
      </div>
      {error && <p role="status" className="text-sm text-muted-foreground">{error}</p>}
      <Button type="button" disabled={busy || !!error} onClick={prepareManualPurchase}>Usar estos datos y clasificar compra</Button>
    </CardContent>
  </Card>;
}
