import { useEffect, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
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
import { createLogger } from '@/lib/logger';
import { lowboySaleFormSchema, lowboySaleInitialStateSchema } from '@/schemas/lowboySale';
import { validateRut } from '@/utils/csvValidations';
import { formatRut } from '@/utils/rutFormatter';
import { businessClock } from '@/utils/businessClock';
import type { LowboySaleFormValues, LowboySaleInitialState, LowboySaleInitialStatus, LowboySaleRow, LowboySaleType } from '@/types/lowboySales';

const logger = createLogger('LowboyVentas');

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
});

interface LowboySaleFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: LowboySaleRow | null;
  isPending: boolean;
  onSubmit: (values: LowboySaleFormValues, initialState?: LowboySaleInitialState) => Promise<void>;
  initialValues?: Partial<LowboySaleFormValues>;
  defaultRetroactive?: boolean;
  defaultInitialStatus?: LowboySaleInitialStatus;
  defaultExecutedDate?: string;
}

export function LowboySaleForm({ open, onOpenChange, sale, isPending, onSubmit, initialValues, defaultRetroactive = false, defaultInitialStatus = 'facturada', defaultExecutedDate = businessClock.today() }: LowboySaleFormProps) {
  const form = useForm<LowboySaleFormValues>({
    resolver: zodResolver(lowboySaleFormSchema),
    defaultValues: emptyValues(),
  });
  const [resolvingRut, setResolvingRut] = useState(false);
  const [retroactive, setRetroactive] = useState(defaultRetroactive);
  const [initialStatus, setInitialStatus] = useState<LowboySaleInitialStatus>(defaultInitialStatus);
  const [executedDate, setExecutedDate] = useState(defaultExecutedDate);
  const [retroactiveError, setRetroactiveError] = useState('');
  // Evita sobrescribir una razón social que el usuario ya escribió a mano.
  const lastResolvedRut = useRef<string>('');

  useEffect(() => {
    if (!open) return;
    form.reset(sale ? valuesFromSale(sale) : { ...emptyValues(), ...initialValues });
    setRetroactive(!sale && defaultRetroactive);
    setInitialStatus(defaultInitialStatus);
    setExecutedDate(defaultExecutedDate);
    setRetroactiveError('');
    lastResolvedRut.current = sale?.client_rut ?? '';
  }, [defaultExecutedDate, defaultInitialStatus, defaultRetroactive, form, initialValues, open, sale]);

  const saleType = form.watch('sale_type');
  const isFlete = saleType === 'flete';

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
      await onSubmit(values, initialState);
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
                      <Input id="sale-executed-date" type="date" value={executedDate} onChange={(event) => setExecutedDate(event.target.value)} />
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

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="scheduled_date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha comprometida</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
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
