import { useEffect, useMemo, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Box, Loader2, Plus, Trash2, Truck } from 'lucide-react';
import { useFieldArray, useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import DatePickerInput from '@/components/common/DatePickerInput';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { resolveRazonSocial } from '@/hooks/siircv/rutResolver';
import { useLowboyContainerInvoiceCandidates, useLowboyContainers } from '@/hooks/siircv/useLowboyContainers';
import { useVehicleBrands } from '@/hooks/useVehicleBrands';
import { useVehicleModels } from '@/hooks/useVehicleModels';
import { fetchVehicleByPlate } from '@/services/vehiclePatentLookup';
import { isChileanPlate } from '@/utils/vehicleIdentifiers';
import { createLogger } from '@/lib/logger';
import { lowboySaleFormSchema, lowboySaleInitialStateSchema } from '@/schemas/lowboySale';
import { validateRut } from '@/utils/csvValidations';
import { formatRut } from '@/utils/rutFormatter';
import { businessClock } from '@/utils/businessClock';
import type { LowboyContainerRow } from '@/types/lowboyContainers';
import { CONTAINER_CONDITION_LABEL, CONTAINER_SIZE_LABEL, CONTAINER_TYPE_LABEL, containerTotalCost } from '@/types/lowboyContainers';
import type { LowboyContainerSaleAssignment, LowboyContainerSaleAssignmentDraft, LowboySaleFormValues, LowboySaleInitialState, LowboySaleInitialStatus, LowboySaleRow, LowboySaleType } from '@/types/lowboySales';
import { composeLowboyContainerDescription, recalculateLowboyAssignmentDefaults } from '@/utils/lowboyContainerAssignments';
import { getLowboySaleMatch } from '@/utils/lowboySaleMatching';

const logger = createLogger('LowboyVentas');
const formatCLP = (value: number) => new Intl.NumberFormat('es-CL', {
  style: 'currency', currency: 'CLP', maximumFractionDigits: 0,
}).format(Number(value) || 0);

const emptyValues = (): LowboySaleFormValues => ({
  sale_type: 'producto',
  client_rut: '',
  client_name: '',
  description: '',
  origin: '',
  destination: '',
  scheduled_date: '',
  net_amount: 0,
  notes: '',
  vehicles: [],
});

const valuesFromSale = (sale: LowboySaleRow): LowboySaleFormValues => ({
  sale_type: sale.sale_type as LowboySaleType,
  client_rut: sale.client_rut,
  client_name: sale.client_name,
  description: sale.description,
  origin: sale.origin ?? '',
  destination: sale.destination ?? '',
  scheduled_date: sale.scheduled_date ?? '',
  net_amount: Number(sale.net_amount),
  notes: sale.notes ?? '',
  vehicles: [...(sale.lowboy_sale_vehicles ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((vehicle) => ({
      plate: vehicle.plate ?? '',
      make: vehicle.make ?? '',
      model: vehicle.model ?? '',
    })),
});

interface LowboySaleFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: LowboySaleRow | null;
  isPending: boolean;
  onSubmit: (values: LowboySaleFormValues, initialState?: LowboySaleInitialState, containerAssignments?: LowboyContainerSaleAssignment[], rcvRecordId?: string) => Promise<void>;
  initialValues?: Partial<LowboySaleFormValues>;
  initialContainerIds?: string[];
  initialRcvRecordId?: string;
  fixedSaleType?: LowboySaleType;
  defaultRetroactive?: boolean;
  defaultInitialStatus?: LowboySaleInitialStatus;
  defaultExecutedDate?: string;
}

export function LowboySaleForm({ open, onOpenChange, sale, isPending, onSubmit, initialValues, initialContainerIds = [], initialRcvRecordId, fixedSaleType, defaultRetroactive = false, defaultInitialStatus = 'facturada', defaultExecutedDate = businessClock.today() }: LowboySaleFormProps) {
  const form = useForm<LowboySaleFormValues>({
    resolver: zodResolver(lowboySaleFormSchema),
    defaultValues: emptyValues(),
  });
  const [resolvingRut, setResolvingRut] = useState(false);
  const [retroactive, setRetroactive] = useState(defaultRetroactive);
  const [initialStatus, setInitialStatus] = useState<LowboySaleInitialStatus>(defaultInitialStatus);
  const [executedDate, setExecutedDate] = useState(defaultExecutedDate);
  const [retroactiveError, setRetroactiveError] = useState('');
  const [containerAssignments, setContainerAssignments] = useState<LowboyContainerSaleAssignmentDraft[]>([]);
  const [rcvRecordId, setRcvRecordId] = useState('');
  const [descriptionManuallyEdited, setDescriptionManuallyEdited] = useState(false);
  const assignmentInitKey = useRef('');
  // Evita sobrescribir una razón social que el usuario ya escribió a mano.
  const lastResolvedRut = useRef<string>('');

  useEffect(() => {
    if (!open) return;
    const resetValues = sale ? valuesFromSale(sale) : { ...emptyValues(), ...initialValues };
    form.reset(fixedSaleType ? { ...resetValues, sale_type: fixedSaleType } : resetValues);
    setRetroactive(!sale && defaultRetroactive);
    setInitialStatus(defaultInitialStatus);
    setExecutedDate(defaultExecutedDate);
    setRetroactiveError('');
    setContainerAssignments([]);
    setRcvRecordId(initialRcvRecordId ?? '');
    setDescriptionManuallyEdited(Boolean(sale));
    assignmentInitKey.current = '';
    lastResolvedRut.current = sale?.client_rut ?? '';
  }, [defaultExecutedDate, defaultInitialStatus, defaultRetroactive, fixedSaleType, form, initialRcvRecordId, initialValues, open, sale]);

  const saleType = form.watch('sale_type');
  const clientRut = form.watch('client_rut');
  const netAmount = Number(form.watch('net_amount')) || 0;
  const isFlete = saleType === 'flete';
  // Los vehículos solo aplican al flujo de venta nueva no histórica; en edición de un
  // flete existente sí se cargan y editan.
  const showVehicles = isFlete && (sale ? true : !retroactive);

  const vehicleFields = useFieldArray({ control: form.control, name: 'vehicles' });
  const [plateLoading, setPlateLoading] = useState<Record<number, boolean>>({});
  const { brands } = useVehicleBrands();
  const { models } = useVehicleModels();
  const brandNames = useMemo(
    () => Array.from(new Set(brands.map((brand) => brand.name).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es')),
    [brands],
  );
  const modelsByBrand = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const model of models) {
      const brandName = model.vehicle_brands?.name?.trim().toLowerCase();
      if (!brandName || !model.name) continue;
      const list = map.get(brandName) ?? [];
      if (!list.includes(model.name)) list.push(model.name);
      map.set(brandName, list);
    }
    return map;
  }, [models]);
  const allModelNames = useMemo(
    () => Array.from(new Set(models.map((model) => model.name).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es')),
    [models],
  );
  // Modelos sugeridos para una fila: si la marca escrita coincide con el catálogo, se
  // acotan a esa marca; si no, se ofrecen todos (nunca se bloquea la escritura libre).
  const modelSuggestionsFor = (make: string): string[] => {
    const matched = modelsByBrand.get(make.trim().toLowerCase());
    return matched && matched.length > 0 ? matched : allModelNames;
  };

  const watchedVehicles = form.watch('vehicles');

  const handleVehiclePlateBlur = async (index: number, rawPlate: string) => {
    const clean = rawPlate.trim().replace(/[-\s]/g, '').toUpperCase();
    if (!isChileanPlate(clean)) return;
    setPlateLoading((prev) => ({ ...prev, [index]: true }));
    try {
      const result = await fetchVehicleByPlate(clean);
      if (result) {
        // Nunca sobrescribimos lo que el usuario ya escribió a mano.
        const makePath = `vehicles.${index}.make` as const;
        const modelPath = `vehicles.${index}.model` as const;
        if (!form.getValues(makePath)?.trim() && result.marca && result.marca !== 'No disponible') {
          form.setValue(makePath, result.marca, { shouldDirty: true });
        }
        if (!form.getValues(modelPath)?.trim() && result.modelo && result.modelo !== 'No disponible') {
          form.setValue(modelPath, result.modelo, { shouldDirty: true });
        }
      }
    } catch (error) {
      logger.warn('No se pudo consultar la patente del vehículo', error);
    } finally {
      setPlateLoading((prev) => ({ ...prev, [index]: false }));
    }
  };
  const { data: stockContainers, isLoading: stockLoading } = useLowboyContainers(open && !isFlete);
  const shouldOfferInvoice = !sale && retroactive && ['facturada', 'pagada'].includes(initialStatus);
  const { data: invoiceCandidates, isLoading: invoicesLoading } = useLowboyContainerInvoiceCandidates(open && shouldOfferInvoice);
  const availableContainers = useMemo(() => (stockContainers ?? []).filter((container) =>
    container.status === 'disponible' || container.sale_id === sale?.id), [sale?.id, stockContainers]);
  const assignedTotal = containerAssignments.reduce((sum, assignment) => sum + Number(assignment.sale_net_price || 0), 0);
  const assignmentMismatch = containerAssignments.length > 0 && Math.round(assignedTotal) !== Math.round(netAmount);
  const sortedInvoices = useMemo(() => [...(invoiceCandidates ?? [])].sort((a, b) => {
    const score = (invoice: typeof a) => getLowboySaleMatch(
      clientRut,
      netAmount,
      invoice.counterpart_rut,
      invoice.net_amount,
    ).score;
    return score(a) - score(b) || b.doc_date.localeCompare(a.doc_date);
  }), [clientRut, invoiceCandidates, netAmount]);

  useEffect(() => {
    if (!shouldOfferInvoice && !initialRcvRecordId) setRcvRecordId('');
  }, [initialRcvRecordId, shouldOfferInvoice]);

  useEffect(() => {
    if (!open || !stockContainers || assignmentInitKey.current) return;
    const selectedIds = sale
      ? stockContainers.filter((container) => container.sale_id === sale.id).map((container) => container.id)
      : initialContainerIds;
    const linked = stockContainers.filter((container) => selectedIds.includes(container.id));
    setContainerAssignments(recalculateLowboyAssignmentDefaults(linked.map((container) => ({
      container_id: container.id,
      sale_net_price: Number(container.sale_net_price || 0),
      manuallyEdited: container.sale_net_price != null,
    })), Number(form.getValues('net_amount')) || 0));
    if (!sale && linked.length > 0 && !form.getValues('description').trim()) {
      form.setValue('description', composeLowboyContainerDescription(linked), { shouldDirty: true, shouldValidate: true });
    }
    assignmentInitKey.current = sale?.id ?? 'new';
  }, [form, initialContainerIds, open, sale, stockContainers]);

  useEffect(() => {
    setContainerAssignments((current) => recalculateLowboyAssignmentDefaults(current, netAmount));
  }, [netAmount]);

  useEffect(() => {
    if (isFlete) setContainerAssignments([]);
  }, [isFlete]);

  const toggleContainer = (container: LowboyContainerRow, selected: boolean) => {
    setContainerAssignments((current) => {
      const next = selected
        ? [...current, { container_id: container.id, sale_net_price: 0, manuallyEdited: false }]
        : current.filter((assignment) => assignment.container_id !== container.id);
      const recalculated = recalculateLowboyAssignmentDefaults(next, netAmount);
      if (!descriptionManuallyEdited) {
        const selectedRows = recalculated
          .map((assignment) => availableContainers.find((candidate) => candidate.id === assignment.container_id))
          .filter((candidate): candidate is LowboyContainerRow => Boolean(candidate));
        form.setValue('description', composeLowboyContainerDescription(selectedRows), { shouldDirty: true, shouldValidate: true });
      }
      return recalculated;
    });
  };

  const updateAssignedPrice = (containerId: string, value: number) => {
    setContainerAssignments((current) => current.map((assignment) => assignment.container_id === containerId
      ? { ...assignment, sale_net_price: Math.max(0, value || 0), manuallyEdited: true }
      : assignment));
  };

  const handleRutBlur = async (rawRut: string) => {
    const rut = rawRut.trim();
    if (!validateRut(rut) || rut === lastResolvedRut.current) return;
    const currentName = form.getValues('client_name').trim();
    // Solo autocompletamos si el campo está vacío (no pisamos lo que el usuario escribió).
    if (currentName) return;
    setResolvingRut(true);
    try {
      const razon = await resolveRazonSocial(rut);
      if (razon && !form.getValues('client_name').trim()) {
        form.setValue('client_name', razon, { shouldValidate: true, shouldDirty: true });
        lastResolvedRut.current = rut;
      }
    } catch (error) {
      logger.warn('No se pudo resolver la razón social', error);
    } finally {
      setResolvingRut(false);
    }
  };

  const handleSubmit = async (values: LowboySaleFormValues) => {
    try {
      const initialState = retroactive && !sale
        ? lowboySaleInitialStateSchema.parse({ status: initialStatus, executed_date: executedDate })
        : undefined;
      setRetroactiveError('');
      await onSubmit(
        // Los vehículos solo viajan cuando la sección está visible (flete no histórico).
        { ...values, vehicles: showVehicles ? values.vehicles : [] },
        initialState,
        containerAssignments.map(({ container_id, sale_net_price }) => ({ container_id, sale_net_price })),
        rcvRecordId || undefined,
      );
      onOpenChange(false);
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') setRetroactiveError('Ingrese una fecha de ejecución válida.');
      // no-op: onError ya lo gestionó (el diálogo queda abierto para reintentar)
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{sale ? 'Editar venta' : 'Nueva venta'}</DialogTitle>
          <DialogDescription>
            {sale
              ? 'Actualice los datos de la venta.'
              : 'Registre una venta de producto (contenedor) o de flete con equipo propio.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
            <FormField control={form.control} name="sale_type" render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de venta</FormLabel>
                <FormControl>
                  <RadioGroup
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={Boolean(fixedSaleType)}
                    className="grid grid-cols-2 gap-3"
                  >
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-500/5">
                      <RadioGroupItem value="producto" id="sale_type_producto" />
                      <span className="text-sm font-medium">Producto (contenedor)</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-500/5">
                      <RadioGroupItem value="flete" id="sale_type_flete" />
                      <span className="text-sm font-medium">Flete (equipo propio)</span>
                    </label>
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="client_rut" render={({ field }) => (
                <FormItem>
                  <FormLabel>RUT del cliente</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="12.345.678-9"
                      onChange={(event) => field.onChange(formatRut(event.target.value))}
                      onBlur={(event) => { field.onBlur(); void handleRutBlur(event.target.value); }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="client_name" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    Razón social
                    {resolvingRut && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
                  </FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Se autocompleta desde el RUT (editable)" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {!sale && (
              <div className="space-y-4 rounded-md border p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label htmlFor="sale-retroactive">Venta ya realizada</Label>
                    <p className="text-xs text-muted-foreground">Registra directamente una venta histórica en su estado real.</p>
                  </div>
                  <Switch id="sale-retroactive" checked={retroactive} onCheckedChange={setRetroactive} />
                </div>
                {retroactive && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="sale-executed-date">Fecha de ejecución</Label>
                      <DatePickerInput id="sale-executed-date" value={executedDate} onChange={setExecutedDate} />
                    </div>
                    <div className="space-y-2">
                      <Label>Estado inicial</Label>
                      <Select value={initialStatus} onValueChange={(value) => setInitialStatus(value as LowboySaleInitialStatus)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ejecutada">Ejecutada</SelectItem>
                          <SelectItem value="facturada">Facturada</SelectItem>
                          <SelectItem value="pagada">Pagada</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {retroactiveError && <p className="text-sm text-destructive sm:col-span-2">{retroactiveError}</p>}
                  </div>
                )}
              </div>
            )}

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Descripción</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder={isFlete ? 'Ej: Flete estructura Santiago→Copiapó' : 'Ej: Contenedor 40HC serie XXXX'}
                    onChange={(event) => { field.onChange(event); setDescriptionManuallyEdited(true); }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {isFlete && (
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="origin" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Origen</FormLabel>
                    <FormControl><Input {...field} placeholder="Ej: Santiago" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="destination" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Destino</FormLabel>
                    <FormControl><Input {...field} placeholder="Ej: Copiapó" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            )}

            {showVehicles && (
              <section className="space-y-3 rounded-md border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                      <Truck className="size-4 text-indigo-600" />Vehículos trasladados (opcional)
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Registre las máquinas o vehículos del flete. La patente autocompleta marca y modelo.
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => vehicleFields.append({ plate: '', make: '', model: '' })}>
                    <Plus className="mr-1.5 size-4" />Agregar vehículo
                  </Button>
                </div>

                {/* Sugerencias de marca compartidas (texto libre, no bloqueante). */}
                <datalist id="lowboy-vehicle-brands">
                  {brandNames.map((name) => <option key={name} value={name} />)}
                </datalist>

                {vehicleFields.fields.length === 0 ? (
                  <p className="py-2 text-center text-xs text-muted-foreground">
                    Sin vehículos. Un flete de estructuras o contenedores puede quedar sin vehículos.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {vehicleFields.fields.map((fieldItem, index) => (
                      <div key={fieldItem.id} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)_auto] sm:items-start">
                        <FormField control={form.control} name={`vehicles.${index}.make`} render={({ field }) => (
                          <FormItem className="space-y-1">
                            <FormLabel className="text-xs sm:sr-only">Marca</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Marca" list="lowboy-vehicle-brands" autoComplete="off" />
                            </FormControl>
                          </FormItem>
                        )} />
                        <FormField control={form.control} name={`vehicles.${index}.model`} render={({ field }) => (
                          <FormItem className="space-y-1">
                            <FormLabel className="text-xs sm:sr-only">Modelo</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Modelo" list={`lowboy-vehicle-models-${index}`} autoComplete="off" />
                            </FormControl>
                            <datalist id={`lowboy-vehicle-models-${index}`}>
                              {modelSuggestionsFor(watchedVehicles?.[index]?.make ?? '').map((name) => (
                                <option key={name} value={name} />
                              ))}
                            </datalist>
                          </FormItem>
                        )} />
                        <FormField control={form.control} name={`vehicles.${index}.plate`} render={({ field }) => (
                          <FormItem className="space-y-1">
                            <FormLabel className="text-xs sm:sr-only">Patente</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  {...field}
                                  placeholder="Patente"
                                  className="font-mono uppercase"
                                  autoComplete="off"
                                  onChange={(event) => field.onChange(event.target.value.toUpperCase())}
                                  onBlur={() => { field.onBlur(); void handleVehiclePlateBlur(index, field.value); }}
                                />
                                {plateLoading[index] && (
                                  <Loader2 className="absolute right-2 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
                                )}
                              </div>
                            </FormControl>
                          </FormItem>
                        )} />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          aria-label={`Eliminar vehículo ${index + 1}`}
                          onClick={() => vehicleFields.remove(index)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="scheduled_date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha comprometida</FormLabel>
                  <FormControl><DatePickerInput value={field.value} onChange={field.onChange} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="net_amount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Neto (CLP)</FormLabel>
                  <FormControl><Input type="number" min={0} step="1" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {!isFlete && (
              <section className="border-y py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold"><Box className="size-4 text-teal-600" />Contenedores del stock</h3>
                    <p className="text-xs text-muted-foreground">Selección opcional · {containerAssignments.length} seleccionado(s)</p>
                  </div>
                  {containerAssignments.length > 0 && (
                    <p className="shrink-0 text-right text-xs text-muted-foreground">Asignado<br /><span className="font-semibold text-foreground">{formatCLP(assignedTotal)}</span></p>
                  )}
                </div>

                {stockLoading ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Cargando stock</div>
                ) : availableContainers.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No hay contenedores disponibles.</p>
                ) : (
                  <div className="mt-3 max-h-80 divide-y overflow-y-auto border-y">
                    {availableContainers.map((container) => {
                      const assignment = containerAssignments.find((item) => item.container_id === container.id);
                      const selected = Boolean(assignment);
                      const cost = containerTotalCost(container);
                      const margin = Number(assignment?.sale_net_price || 0) - cost;
                      return (
                        <div key={container.id} className="space-y-3 py-3">
                          <label className="flex cursor-pointer items-start gap-3 px-1">
                            <Checkbox className="mt-0.5" checked={selected} onCheckedChange={(checked) => toggleContainer(container, checked === true)} />
                            <span className="min-w-0 flex-1">
                              <span className="block break-all font-mono text-sm font-semibold">{container.serial_number || 'Sin serie'}</span>
                              <span className="block text-xs text-muted-foreground">
                                {CONTAINER_SIZE_LABEL[container.size as keyof typeof CONTAINER_SIZE_LABEL]} · {CONTAINER_TYPE_LABEL[container.container_type as keyof typeof CONTAINER_TYPE_LABEL]} · {CONTAINER_CONDITION_LABEL[container.condition as keyof typeof CONTAINER_CONDITION_LABEL]}
                              </span>
                            </span>
                            <span className="shrink-0 text-right text-xs"><span className="block text-muted-foreground">Costo total</span><span className="font-semibold">{formatCLP(cost)}</span></span>
                          </label>
                          {assignment && (
                            <div className="grid gap-3 px-1 sm:grid-cols-[1fr_auto] sm:items-end">
                              <div className="space-y-1.5">
                                <Label htmlFor={`container-price-${container.id}`}>Precio neto asignado</Label>
                                <Input id={`container-price-${container.id}`} type="number" min={0} step={1} value={assignment.sale_net_price} onChange={(event) => updateAssignedPrice(container.id, Number(event.target.value))} />
                              </div>
                              <div className="sm:min-w-32 sm:pb-2 sm:text-right">
                                <p className="text-xs text-muted-foreground">Margen</p>
                                <p className={`font-semibold ${margin >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>{formatCLP(margin)}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {assignmentMismatch && (
                  <div className="mt-3 flex items-start gap-2 border-l-4 border-amber-500 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <span>La suma asignada ({formatCLP(assignedTotal)}) no coincide con el neto de la venta ({formatCLP(netAmount)}). Puede guardar igualmente.</span>
                  </div>
                )}
              </section>
            )}

            {shouldOfferInvoice && (
              <div className="space-y-2">
                <Label>Vincular factura del RCV (opcional)</Label>
                <Select
                  value={rcvRecordId || 'none'}
                  onValueChange={(value) => {
                    const nextId = value === 'none' ? '' : value;
                    setRcvRecordId(nextId);
                    const invoice = invoiceCandidates?.find((candidate) => candidate.id === nextId);
                    if (invoice) setExecutedDate(invoice.doc_date);
                  }}
                  disabled={invoicesLoading}
                >
                  <SelectTrigger><SelectValue placeholder={invoicesLoading ? 'Cargando facturas...' : 'Seleccione una factura'} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin vincular factura</SelectItem>
                    {sortedInvoices.map((invoice) => {
                      const { rutMatches, amountMatches } = getLowboySaleMatch(
                        clientRut,
                        netAmount,
                        invoice.counterpart_rut,
                        invoice.net_amount,
                      );
                      return (
                        <SelectItem key={invoice.id} value={invoice.id}>
                          <span className="flex flex-wrap items-center gap-1.5">
                            <span>Folio {invoice.folio} · {invoice.counterpart_name || invoice.counterpart_rut} · {formatCLP(invoice.net_amount)}</span>
                            {rutMatches && <span className="rounded-full border px-2 py-0.5 text-xs font-semibold text-emerald-700">RUT</span>}
                            {amountMatches && <span className="rounded-full border px-2 py-0.5 text-xs font-semibold text-emerald-700">Monto</span>}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notas</FormLabel>
                <FormControl><Textarea rows={3} {...field} placeholder="Notas internas (opcional)" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Cancelar</Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                {sale ? 'Guardar cambios' : 'Crear venta'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
