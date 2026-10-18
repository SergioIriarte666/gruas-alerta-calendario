import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Camera, CheckCircle2, Clock, Loader2, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { useManualPurchaseDraft } from '@/hooks/useManualPurchaseDraft';
import { useCostCategories } from '@/hooks/useCostCategories';
import { useCostCenters } from '@/hooks/useCostCenters';
import { useCranes } from '@/hooks/useCranes';
import { useUniversalSync } from '@/hooks/useUniversalSync';
import { supabase } from '@/integrations/supabase/client';
import { ManualPurchaseInput } from '@/components/inventory/ManualPurchaseInput';
import { XMLImportDialogHeader } from '@/components/common/XMLImportShared';
import DatePickerInput from '@/components/common/DatePickerInput';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { buildManualCostPayload, registerManualCost, type ManualCostClassification } from '@/services/manualCost';
import { validateManualPurchase } from '@/utils/manualPurchase';
import { isImportDateValid } from '@/utils/xml/xmlInventoryWizard';
import { formatCurrency } from '@/utils/xml/xmlInventoryHelpers';
import { ENTITIES } from '@/lib/entities';
import { businessClock } from '@/utils/businessClock';
import { normalizeSupplierName, normalizeSupplierRut, supplierRutVariants } from '@/utils/supplierIdentity';
import { cn } from '@/lib/utils';

function ClassificationSelect({ id, label, value, options, onChange, optional = true }: {
  id: string; label: string; value: string; options: { id: string; name: string }[]; onChange: (value: string) => void; optional?: boolean;
}) {
  return <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label><Select value={value || 'none'} onValueChange={value => onChange(value === 'none' ? '' : value)}><SelectTrigger id={id}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">{optional ? 'Sin asociar' : 'Seleccionar'}</SelectItem>{options.map(option => <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>)}</SelectContent></Select></div>;
}

const initialClassification = (): ManualCostClassification => ({ categoryId: '', costCenterId: '', craneId: '', entity: 'gruas_5_norte', paidBy: 'gruas_5_norte', subcategories: {}, headerSubcategoryId: '', description: '', isPaid: false, paymentDate: businessClock.today(), paymentReference: '' });

export function ManualCostPurchaseDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess?: () => void }) {
  const manual = useManualPurchaseDraft();
  const [step, setStep] = useState(1);
  const [prepared, setPrepared] = useState(false);
  const [classification, setClassification] = useState(initialClassification);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [attempted, setAttempted] = useState(false);
  const submitting = useRef(false);
  const content = useRef<HTMLDivElement>(null);
  const requestId = useRef(crypto.randomUUID());
  useEffect(() => { if (content.current) content.current.scrollTop = 0; }, [step]);
  const { data: categories = [], isPending: categoriesLoading, isError: categoriesError } = useCostCategories();
  const { data: centers = [], isPending: centersLoading, isError: centersError } = useCostCenters();
  const { cranes } = useCranes();
  const { invalidateAll } = useUniversalSync();
  const subcategoryQuery = useQuery({
    queryKey: ['manual-cost-subcategories', classification.categoryId],
    enabled: !!classification.categoryId,
    queryFn: async () => {
      const { data, error } = await supabase.from('cost_subcategories').select('id, name, category_id').eq('category_id', classification.categoryId).eq('is_active', true).order('display_order');
      if (error) throw error;
      return data || [];
    },
  });
  const subcategories = subcategoryQuery.data || [];
  const { draft } = manual;
  const supplierQuery = useQuery({
    queryKey: ['manual-cost-supplier-identity', normalizeSupplierRut(draft.supplierRut)],
    enabled: prepared,
    queryFn: async () => {
      const { data, error } = await supabase.from('inventory_suppliers').select('id, name, rut').in('rut', supplierRutVariants(draft.supplierRut));
      if (error) throw error;
      return data?.find(supplier => normalizeSupplierRut(supplier.rut) === normalizeSupplierRut(draft.supplierRut)) || null;
    },
  });
  const registeredSupplier = supplierQuery.data;
  const supplierConflict = registeredSupplier?.rut && normalizeSupplierRut(registeredSupplier.rut) === normalizeSupplierRut(draft.supplierRut) && normalizeSupplierName(registeredSupplier.name) !== normalizeSupplierName(draft.supplierName);
  const busy = saving || manual.photoBusy || manual.extracting;
  const update = <Key extends keyof ManualCostClassification>(field: Key, value: ManualCostClassification[Key]) => setClassification(previous => ({ ...previous, [field]: value }));
  const validationError = validateManualPurchase(draft, true);
  const classificationError = validationError
    || (supplierQuery.isFetching ? 'Verificando identidad del proveedor…' : supplierQuery.isError ? 'No se pudo verificar el proveedor. Reintenta antes de guardar.' : null)
    || (supplierConflict && !classification.supplierNameChoice ? 'Confirma qué razón social corresponde al RUT del emisor.' : null)
    || (categoriesLoading || centersLoading ? 'Cargando categorías y centros de costo…' : null)
    || (categoriesError || centersError ? 'No se pudieron cargar las opciones. Cierra y vuelve a intentar.' : null)
    || (!categories.some(category => category.id === classification.categoryId) ? 'Selecciona una categoría de costo.' : null)
    || (subcategoryQuery.isFetching ? 'Cargando subcategorías…' : subcategoryQuery.isError ? 'No se pudieron cargar las subcategorías. Reintenta antes de guardar.' : null)
    || (!classification.description.trim() ? 'Indica una glosa para el costo.' : null)
    || (classification.isPaid && !isImportDateValid(classification.paymentDate) ? 'Indica la fecha real de pago.' : null)
    || (Object.values(classification.subcategories).some(id => id && !subcategories.some(option => option.id === id)) || (classification.headerSubcategoryId && !subcategories.some(option => option.id === classification.headerSubcategoryId)) ? 'Revisa las subcategorías de la categoría elegida.' : null);
  const prepare = () => {
    if (validationError) { toast.error(validationError); return; }
    setPrepared(true);
    setClassification(previous => ({ ...previous, subcategories: {}, headerSubcategoryId: '', description: `Factura ${draft.folio} · ${draft.supplierName}`, isPaid: false, paymentReference: '', supplierNameChoice: undefined }));
    setStep(2);
  };
  const save = async () => {
    if (submitting.current || classificationError) return;
    submitting.current = true;
    setSaving(true); setAttempted(true); setSaveError('');
    try {
      await registerManualCost(requestId.current, buildManualCostPayload(draft, classification), manual.photo);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'No se pudo guardar el costo.');
      return;
    } finally {
      submitting.current = false;
      setSaving(false);
    }
    toast.success('Factura registrada en Costos con su clasificación y estado de pago.');
    void Promise.resolve(invalidateAll()).catch(() => toast.warning('El costo se guardó. Actualiza la lista para verlo.'));
    onSuccess?.();
    onClose();
  };
  const categoryName = categories.find(category => category.id === classification.categoryId)?.name || 'Falta clasificar el costo';
  const subcategoryName = (id: string) => subcategories.find(option => option.id === id)?.name || 'Sin subcategoría';
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent className="finance-dialog flex h-[94dvh] w-[calc(100vw-1rem)] max-w-[84rem] flex-col gap-0 overflow-hidden bg-card p-0 sm:w-[min(96vw,84rem)]">
      <XMLImportDialogHeader icon={Camera} title="Registrar factura en Costos" description="Desde foto o manual · un costo consolidado, sin movimientos de bodega." fileName={manual.photo?.name} emptyFileLabel="Ingreso manual sin foto" documentCount={prepared ? 1 : 0} />
      <div className="shrink-0 space-y-3 border-b px-3 py-3 sm:px-6">
        <nav className="grid grid-cols-3 gap-2" aria-label="Etapas del registro de costo">{['Comprobante', 'Clasificación y pago', 'Revisión'].map((name, index) => <Button key={name} variant="outline" aria-current={step === index + 1 ? 'step' : undefined} disabled={busy || attempted || (index > 0 && !prepared) || (index === 2 && !!classificationError)} onClick={() => setStep(index + 1)} className={cn('h-auto min-h-10 whitespace-normal px-2 text-xs sm:text-sm', step === index + 1 && 'border-primary bg-primary/10')}>{index + 1}. {name}</Button>)}</nav>
        <div className="flex flex-wrap justify-between gap-2 rounded-xl bg-primary/5 px-3 py-2 text-sm"><span>{categoryName} · {classification.isPaid ? 'Pagada' : 'Pendiente de pago'}</span><strong>{formatCurrency(Number(draft.total))}</strong></div>
      </div>
      <div ref={content} className="min-h-0 flex-1 space-y-5 overflow-y-auto bg-muted/20 px-3 py-4 sm:px-6">
        {step === 1 && <ManualPurchaseInput allowNoDetails upload={{ manual, manualPrepared: prepared, prepareManualPurchase: prepare, editManualPurchase: () => setPrepared(false), isImporting: saving }} />}
        {step === 2 && <>
          <Alert><AlertDescription>Este registro es solo financiero: no crea productos, entradas ni consumos en Bodega. La grúa es una referencia del costo, no un destino de consumo.</AlertDescription></Alert>
          {supplierConflict && <Alert className="border-warning/30 bg-warning/10"><AlertDescription className="space-y-3"><p><strong>Revisar razón social · RUT {draft.supplierRut}</strong></p><p>Comprobante: {draft.supplierName}. Proveedor registrado: {registeredSupplier.name}.</p><p>Usar el nombre del comprobante actualizará ese proveedor al guardar, también visible en sus registros anteriores; no cambia su RUT ni su identificador.</p><div className="flex flex-wrap gap-2"><Button variant="outline" aria-pressed={classification.supplierNameChoice === 'document'} onClick={() => update('supplierNameChoice', 'document')}>Usar nombre del comprobante</Button><Button variant="outline" aria-pressed={classification.supplierNameChoice === 'master'} onClick={() => update('supplierNameChoice', 'master')}>Conservar nombre registrado</Button></div></AlertDescription></Alert>}
          <div className="grid gap-5 lg:grid-cols-2">
            <Card><CardHeader><CardTitle className="text-base">Clasificación del costo</CardTitle></CardHeader><CardContent className="space-y-4">
              <ClassificationSelect id="manual-cost-category" label="Categoría de costo *" value={classification.categoryId} optional={false} options={categories} onChange={value => setClassification(previous => ({ ...previous, categoryId: value, costCenterId: categories.find(category => category.id === value)?.default_cost_center_id || '', subcategories: {}, headerSubcategoryId: '' }))} />
              <ClassificationSelect id="manual-cost-center" label="Centro de costo" value={classification.costCenterId} options={centers} onChange={value => update('costCenterId', value)} />
              <ClassificationSelect id="manual-cost-entity" label="Empresa dueña del gasto" value={classification.entity} optional={false} options={Object.values(ENTITIES).map(entity => ({ id: entity.key, name: entity.label }))} onChange={value => { if (value === 'lowboy' || value === 'gruas_5_norte') update('entity', value); }} />
              <ClassificationSelect id="manual-cost-paid-by" label="Empresa que financia" value={classification.paidBy} optional={false} options={Object.values(ENTITIES).map(entity => ({ id: entity.key, name: entity.label }))} onChange={value => { if (value === 'lowboy' || value === 'gruas_5_norte') update('paidBy', value); }} />
              <ClassificationSelect id="manual-cost-crane" label="Grúa de referencia (opcional)" value={classification.craneId} options={cranes.map(crane => ({ id: crane.id, name: crane.licensePlate || `${crane.brand} ${crane.model}` }))} onChange={value => update('craneId', value)} />
              <div className="space-y-1.5"><Label htmlFor="manual-cost-description">Glosa del costo *</Label><Input id="manual-cost-description" value={classification.description} maxLength={500} onChange={event => update('description', event.target.value)} /></div>
            </CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base">Estado de pago</CardTitle></CardHeader><CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2">{[false, true].map(paid => <Button key={String(paid)} variant="outline" aria-pressed={classification.isPaid === paid} className={cn(classification.isPaid === paid && 'border-primary bg-primary/10')} onClick={() => update('isPaid', paid)}>{paid ? <CheckCircle2 className="mr-2 size-4" /> : <Clock className="mr-2 size-4" />}{paid ? 'Pagada' : 'Pendiente'}</Button>)}</div>
              {classification.isPaid && <><div className="space-y-1.5"><Label htmlFor="manual-cost-payment-date">Fecha de pago *</Label><DatePickerInput id="manual-cost-payment-date" value={classification.paymentDate} onChange={value => update('paymentDate', value)} /></div><div className="space-y-1.5"><Label htmlFor="manual-cost-payment-reference">Referencia de pago</Label><Input id="manual-cost-payment-reference" value={classification.paymentReference} maxLength={200} onChange={event => update('paymentReference', event.target.value)} placeholder="N.º de operación (opcional)" /></div></>}
              <Alert><AlertDescription>Una foto que diga “contado” no marca el pago automáticamente. Confirma el estado real; la factura tendrá un único registro de pago al proveedor.</AlertDescription></Alert>
            </CardContent></Card>
          </div>
          <Card><CardHeader><CardTitle className="text-base">{draft.lines.length ? 'Subcategoría por producto' : 'Clasificación del gasto sin detalle'}</CardTitle></CardHeader><CardContent className="space-y-3">
            {draft.lines.length ? draft.lines.map((line, index) => <div key={line.id} className="grid items-center gap-3 rounded-xl border p-3 sm:grid-cols-2"><div><p className="font-medium">{index + 1}. {line.description}</p><p className="text-xs text-muted-foreground">{line.code || 'Sin código'} · {line.quantity} × {formatCurrency(Number(line.unitPrice))} neto</p></div><ClassificationSelect id={`manual-cost-subcategory-${index}`} label={`Subcategoría del producto ${index + 1}`} value={classification.subcategories[line.id] || ''} options={subcategories} onChange={value => update('subcategories', { ...classification.subcategories, [line.id]: value })} /></div>) : <ClassificationSelect id="manual-cost-header-subcategory" label="Subcategoría del gasto" value={classification.headerSubcategoryId} options={subcategories} onChange={value => update('headerSubcategoryId', value)} />}
            <p className="text-xs text-muted-foreground">Se conserva un solo costo por el total de la factura; las subcategorías se muestran en su detalle.</p>
          </CardContent></Card>
        </>}
        {step === 3 && <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Receipt className="size-4 text-primary" />Revisar antes de registrar</CardTitle></CardHeader><CardContent className="space-y-4">
          <div><p className="font-semibold">Factura {draft.folio} · {draft.supplierName}</p><p className="text-sm text-muted-foreground">RUT {draft.supplierRut} · Emisión {draft.issueDate} · Vencimiento {draft.dueDate || draft.issueDate}</p></div>
          <p>Proveedor a vincular: {classification.supplierNameChoice === 'master' ? registeredSupplier?.name : draft.supplierName} · RUT emisor {draft.supplierRut}</p>
          <p>{classification.description}</p><p>{categoryName} · {centers.find(center => center.id === classification.costCenterId)?.name || 'Sin centro de costo'}</p>
          <p>{Object.values(ENTITIES).find(entity => entity.key === classification.entity)?.label} · Financia: {Object.values(ENTITIES).find(entity => entity.key === classification.paidBy)?.label}</p>
          {classification.craneId && <p>Grúa de referencia: {cranes.find(crane => crane.id === classification.craneId)?.licensePlate || classification.craneId}</p>}
          <p className="font-medium">{classification.isPaid ? `Pagada el ${classification.paymentDate}` : 'Pendiente de pago'}{classification.isPaid && classification.paymentReference ? ` · Referencia: ${classification.paymentReference}` : ''}</p>
          <div className="divide-y rounded-xl border">{draft.lines.length ? draft.lines.map(line => <div key={line.id} className="flex flex-wrap justify-between gap-2 p-3 text-sm"><span>{line.code} · {line.description} · {line.quantity} × {formatCurrency(Number(line.unitPrice))} neto</span><span>{subcategoryName(classification.subcategories[line.id])}</span></div>) : <p className="p-3 text-sm">Sin detalle de productos · {subcategoryName(classification.headerSubcategoryId)}</p>}</div>
          <p>Neto {formatCurrency(Number(draft.net))} · IVA {formatCurrency(Number(draft.vat))} · <strong>Total {formatCurrency(Number(draft.total))}</strong></p>
          <Alert><AlertDescription>{manual.photo ? 'Foto revisada: se guardará como respaldo privado.' : 'Ingreso manual sin foto de respaldo.'} Se registra un costo y su factura/pago en una sola operación. No se modifica Bodega.</AlertDescription></Alert>
        </CardContent></Card>}
        {saveError && <Alert variant="destructive"><AlertDescription>{saveError} Puedes reintentar sin duplicar el registro. Para modificar datos, cierra y verifica primero si la factura ya quedó registrada.</AlertDescription></Alert>}
      </div>
      <div className="shrink-0 space-y-2 border-t bg-card px-3 py-3 sm:px-6">
        {step > 1 && classificationError && <p role="status" className="text-sm text-warning">{classificationError}</p>}
        <div className="flex flex-wrap justify-between gap-2"><Button variant="outline" disabled={busy} onClick={onClose}>Cerrar</Button><div className="flex flex-wrap gap-2">{step > 1 && <Button variant="outline" disabled={busy || attempted} onClick={() => setStep(step - 1)}>Atrás</Button>}{step < 3 ? <Button disabled={busy || !prepared || (step === 2 && !!classificationError)} onClick={() => setStep(step + 1)}>{step === 1 ? 'Continuar a clasificación' : 'Revisar registro'}</Button> : <Button disabled={busy || !!classificationError} onClick={() => void save()}>{saving && <Loader2 className="mr-2 size-4 animate-spin" />}{saving ? 'Guardando…' : attempted ? 'Reintentar guardado' : 'Confirmar registro en Costos'}</Button>}</div></div>
      </div>
    </DialogContent>
  </Dialog>;
}
