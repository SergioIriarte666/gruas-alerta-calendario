import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { parseISO } from 'date-fns';
import { Loader2, Trash2 } from 'lucide-react';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter as AlertDialogFooterUI, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { businessClock } from '@/utils/businessClock';
import {
  LEGACY_SERVICE_TYPE_OPTIONS,
  LEGACY_VEHICLE_TYPE_OPTIONS,
  normalizeLegacyRow,
  type LegacyRow,
} from '@/utils/legacyServicesParser';
import { formatForDisplayWithTime } from '@/utils/timezoneUtils';

const logger = createLogger('EditLegacyServiceModal');

const editLegacyServiceSchema = z.object({
  received_at_local: z.string().min(1, 'La fecha y hora es requerida'),
  manual_folio: z.string().trim(),
  expediente: z.string().trim(),
  insurer: z.string().trim(),
  service_type: z.string().trim().min(1, 'Seleccione un tipo de servicio'),
  vehicle_brand: z.string().trim(),
  vehicle_type: z.string().trim().min(1, 'Seleccione un tipo de vehículo'),
  license_plate: z.string().trim(),
  vin: z.string().trim(),
  origin: z.string().trim(),
  destination: z.string().trim(),
  crane_label: z.string().trim(),
  operator_label: z.string().trim(),
  total_clp: z.coerce.number().min(0, 'El total no puede ser negativo'),
  observations: z.string().trim(),
});

type EditLegacyServiceFormValues = z.infer<typeof editLegacyServiceSchema>;

type LegacyServiceImportMeta = {
  filename: string | null;
  created_at: string | null;
} | null;

type EditableLegacyServiceRecord = {
  id: string;
  created_at: string;
  received_at: string;
  manual_folio: string | null;
  expediente: string | null;
  insurer: string | null;
  service_type: string | null;
  vehicle_brand: string | null;
  vehicle_type: string | null;
  license_plate: string | null;
  vin: string | null;
  origin: string | null;
  destination: string | null;
  crane_label: string | null;
  operator_label: string | null;
  total_clp: number;
  observations: string | null;
  legacy_service_imports?: LegacyServiceImportMeta;
};

interface EditLegacyServiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceId: string | null;
  onSaved: () => void | Promise<void>;
}

const formatCLP = (value: number) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value || 0);

const toFormValues = (record: EditableLegacyServiceRecord): EditLegacyServiceFormValues => ({
  received_at_local: formatInTimeZone(parseISO(record.received_at), businessClock.timezone(), "yyyy-MM-dd'T'HH:mm"),
  manual_folio: record.manual_folio ?? '',
  expediente: record.expediente ?? '',
  insurer: record.insurer ?? '',
  service_type: record.service_type ?? '',
  vehicle_brand: record.vehicle_brand ?? '',
  vehicle_type: record.vehicle_type ?? '',
  license_plate: record.license_plate ?? '',
  vin: record.vin ?? '',
  origin: record.origin ?? '',
  destination: record.destination ?? '',
  crane_label: record.crane_label ?? '',
  operator_label: record.operator_label ?? '',
  total_clp: Number(record.total_clp || 0),
  observations: record.observations ?? '',
});

export function EditLegacyServiceModal({
  open,
  onOpenChange,
  serviceId,
  onSaved,
}: EditLegacyServiceModalProps) {
  const [record, setRecord] = useState<EditableLegacyServiceRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const form = useForm<EditLegacyServiceFormValues>({
    resolver: zodResolver(editLegacyServiceSchema),
    defaultValues: {
      received_at_local: '',
      manual_folio: '',
      expediente: '',
      insurer: '',
      service_type: '',
      vehicle_brand: '',
      vehicle_type: '',
      license_plate: '',
      vin: '',
      origin: '',
      destination: '',
      crane_label: '',
      operator_label: '',
      total_clp: 0,
      observations: '',
    },
  });

  const watchedTotal = form.watch('total_clp') ?? 0;
  const deleteSummary = useMemo(() => {
    if (!record) return '¿Eliminar este registro?';
    const filename = record.legacy_service_imports?.filename ?? 'archivo desconocido';
    const createdAt = record.legacy_service_imports?.created_at ?? record.created_at;
    return `El registro pertenece a la importación "${filename}" del ${formatForDisplayWithTime(createdAt)}. No afecta a los demás registros de esa importación.`;
  }, [record]);

  useEffect(() => {
    if (!open || !serviceId) {
      setRecord(null);
      form.reset();
      return;
    }

    let cancelled = false;
    const loadRecord = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('legacy_services')
          .select('id, created_at, received_at, manual_folio, expediente, insurer, service_type, vehicle_brand, vehicle_type, license_plate, vin, origin, destination, crane_label, operator_label, total_clp, observations, legacy_service_imports(filename, created_at)')
          .eq('id', serviceId)
          .single();

        if (error) throw error;
        if (cancelled) return;

        const nextRecord = data as unknown as EditableLegacyServiceRecord;
        setRecord(nextRecord);
        form.reset(toFormValues(nextRecord));
      } catch (error) {
        logger.error('No fue posible cargar el servicio legacy', error);
        toast.error(error instanceof Error ? error.message : 'No fue posible cargar el registro.');
        onOpenChange(false);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void loadRecord();
    return () => {
      cancelled = true;
    };
  }, [form, onOpenChange, open, serviceId]);

  const handleSave = async (values: EditLegacyServiceFormValues) => {
    if (!serviceId) return;

    const normalizedRow = normalizeLegacyRow({
      received_at: fromZonedTime(values.received_at_local, businessClock.timezone()).toISOString(),
      manual_folio: values.manual_folio,
      expediente: values.expediente,
      insurer: values.insurer,
      service_type: values.service_type,
      vehicle_brand: values.vehicle_brand,
      vehicle_type: values.vehicle_type,
      license_plate: values.license_plate,
      vin: values.vin,
      origin: values.origin,
      destination: values.destination,
      crane_label: values.crane_label,
      operator_label: values.operator_label,
      total_clp: values.total_clp,
      observations: values.observations,
      _rowIndex: 0,
      _invalidDate: false,
      _isTemplateExample: false,
    } satisfies LegacyRow);

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('legacy_services')
        .update({
          received_at: normalizedRow.received_at!,
          manual_folio: normalizedRow.manual_folio || null,
          expediente: normalizedRow.expediente || null,
          insurer: normalizedRow.insurer || null,
          service_type: normalizedRow.service_type || null,
          vehicle_brand: normalizedRow.vehicle_brand || null,
          vehicle_type: normalizedRow.vehicle_type || null,
          license_plate: normalizedRow.license_plate || null,
          vin: normalizedRow.vin || null,
          origin: normalizedRow.origin || null,
          destination: normalizedRow.destination || null,
          crane_label: normalizedRow.crane_label || null,
          operator_label: normalizedRow.operator_label || null,
          total_clp: normalizedRow.total_clp,
          observations: normalizedRow.observations || null,
        })
        .eq('id', serviceId);

      if (error) throw error;

      await onSaved();
      onOpenChange(false);
      const normalizedCount = normalizedRow._normalizationChangeCount ?? 0;
      toast.success(normalizedCount > 0
        ? `Cambios guardados. Se aplicó normalización a ${normalizedCount} campos.`
        : 'Cambios guardados.');
    } catch (error) {
      logger.error('No fue posible guardar el servicio legacy', error);
      toast.error(error instanceof Error ? error.message : 'No fue posible guardar los cambios.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!serviceId) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase.from('legacy_services').delete().eq('id', serviceId);
      if (error) throw error;

      await onSaved();
      setConfirmDeleteOpen(false);
      onOpenChange(false);
      toast.success('Registro eliminado.');
    } catch (error) {
      logger.error('No fue posible eliminar el servicio legacy', error);
      toast.error(error instanceof Error ? error.message : 'No fue posible eliminar el registro.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92vh] w-[95vw] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar servicio legacy</DialogTitle>
            <DialogDescription>
              Corrige el registro histórico sin afectar servicios operativos actuales.
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex min-h-72 items-center justify-center">
              <Loader2 className="size-8 animate-spin text-warning-text" />
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="received_at_local"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fecha/hora de recepción</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="total_clp"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            {...field}
                            onChange={(event) => field.onChange(Number(event.target.value))}
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">{formatCLP(Number(watchedTotal || 0))}</p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField control={form.control} name="manual_folio" render={({ field }) => (
                    <FormItem><FormLabel>Folio sistema antiguo</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="expediente" render={({ field }) => (
                    <FormItem><FormLabel>N° Siniestro / Expediente</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField control={form.control} name="insurer" render={({ field }) => (
                    <FormItem><FormLabel>Aseguradora</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField
                    control={form.control}
                    name="service_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de servicio</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccione un tipo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {LEGACY_SERVICE_TYPE_OPTIONS.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField control={form.control} name="vehicle_brand" render={({ field }) => (
                    <FormItem><FormLabel>Marca del vehículo</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField
                    control={form.control}
                    name="vehicle_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de vehículo</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccione un tipo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {LEGACY_VEHICLE_TYPE_OPTIONS.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField control={form.control} name="license_plate" render={({ field }) => (
                    <FormItem><FormLabel>Placas del vehículo</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="vin" render={({ field }) => (
                    <FormItem><FormLabel>VIN</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField control={form.control} name="origin" render={({ field }) => (
                    <FormItem><FormLabel>Origen</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="destination" render={({ field }) => (
                    <FormItem><FormLabel>Destino</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField control={form.control} name="crane_label" render={({ field }) => (
                    <FormItem><FormLabel>Grúa</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="operator_label" render={({ field }) => (
                    <FormItem><FormLabel>Operador</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>

                <FormField
                  control={form.control}
                  name="observations"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observaciones</FormLabel>
                      <FormControl>
                        <Textarea rows={4} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
                  <Button
                    type="button"
                    variant="destructive"
                    className="mr-auto"
                    onClick={() => setConfirmDeleteOpen(true)}
                    disabled={isSaving || isDeleting}
                  >
                    <Trash2 className="mr-2 size-4" />
                    Eliminar registro
                  </Button>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving || isDeleting}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={isSaving || isDeleting}>
                      {isSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                      Guardar cambios
                    </Button>
                  </div>
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este registro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción NO se puede deshacer. {deleteSummary}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooterUI>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooterUI>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
