import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { businessClock } from '@/utils/businessClock';
import { validateRut } from '@/utils/csvValidations';
import { formatRut } from '@/utils/rutFormatter';
import type { SiiBookType, SiiRcvRecordFormValues, SiiRcvRecordRow } from '@/types/siiRcv';

const schema = z.object({
  book_type: z.enum(['compra', 'venta']),
  doc_type: z.coerce.number().int().positive('Ingrese un tipo de documento válido'),
  folio: z.coerce.number().int().nonnegative('El folio no puede ser negativo'),
  counterpart_rut: z.string().trim().refine(validateRut, 'Use un RUT con formato 12.345.678-9'),
  counterpart_name: z.string().trim().min(1, 'Ingrese la razón social'),
  doc_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ingrese una fecha válida'),
  net_amount: z.coerce.number().nonnegative('El monto no puede ser negativo'),
  exempt_amount: z.coerce.number().nonnegative('El monto no puede ser negativo'),
  tax_amount: z.coerce.number().nonnegative('El monto no puede ser negativo'),
  total_amount: z.coerce.number().nonnegative('El monto no puede ser negativo'),
});

const defaultValues = (bookType: SiiBookType): SiiRcvRecordFormValues => ({
  book_type: bookType,
  doc_type: 33,
  folio: 0,
  counterpart_rut: '',
  counterpart_name: '',
  doc_date: businessClock.today(),
  net_amount: 0,
  exempt_amount: 0,
  tax_amount: 0,
  total_amount: 0,
});

const valuesFromRecord = (record: SiiRcvRecordRow): SiiRcvRecordFormValues => ({
  book_type: record.book_type as SiiBookType,
  doc_type: Number(record.doc_type),
  folio: Number(record.folio),
  counterpart_rut: record.counterpart_rut,
  counterpart_name: record.counterpart_name ?? '',
  doc_date: record.doc_date,
  net_amount: Number(record.net_amount),
  exempt_amount: Number(record.exempt_amount),
  tax_amount: Number(record.tax_amount),
  total_amount: Number(record.total_amount),
});

interface LowboyRecordFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: SiiRcvRecordRow | null;
  defaultBookType: SiiBookType;
  isPending: boolean;
  onSubmit: (values: SiiRcvRecordFormValues) => Promise<void>;
}

export function LowboyRecordForm({
  open,
  onOpenChange,
  record,
  defaultBookType,
  isPending,
  onSubmit,
}: LowboyRecordFormProps) {
  const form = useForm<SiiRcvRecordFormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues(defaultBookType),
  });

  useEffect(() => {
    if (!open) return;
    form.reset(record ? valuesFromRecord(record) : defaultValues(defaultBookType));
  }, [defaultBookType, form, open, record]);

  const handleSubmit = async (values: SiiRcvRecordFormValues) => {
    await onSubmit(values);
    onOpenChange(false);
  };

  const linked = Boolean(record?.linked_cost_id || record?.linked_service_id);
  const amountFields = [
    ['net_amount', 'Monto neto'],
    ['exempt_amount', 'Monto exento'],
    ['tax_amount', 'IVA'],
    ['total_amount', 'Monto total'],
  ] as const;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{record ? 'Editar registro Lowboy' : 'Nuevo registro Lowboy'}</DialogTitle>
          <DialogDescription>
            {record ? 'Actualice los datos tributarios del documento.' : 'Ingrese manualmente un documento de compra o venta.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField control={form.control} name="book_type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Libro</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={linked}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="compra">Compra</SelectItem>
                      <SelectItem value="venta">Venta</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="doc_type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo documento</FormLabel>
                  <FormControl><Input type="number" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="folio" render={({ field }) => (
                <FormItem>
                  <FormLabel>Folio</FormLabel>
                  <FormControl><Input type="number" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="counterpart_rut" render={({ field }) => (
                <FormItem>
                  <FormLabel>RUT contraparte</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="12.345.678-9" onChange={(event) => field.onChange(formatRut(event.target.value))} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="doc_date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha documento</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="counterpart_name" render={({ field }) => (
              <FormItem>
                <FormLabel>Razón social</FormLabel>
                <FormControl><Input {...field} placeholder="Nombre de proveedor o cliente" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid gap-4 sm:grid-cols-2">
              {amountFields.map(([name, label]) => (
                <FormField key={name} control={form.control} name={name} render={({ field }) => (
                  <FormItem>
                    <FormLabel>{label}</FormLabel>
                    <FormControl><Input type="number" min={0} step="1" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              ))}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Cancelar</Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                {record ? 'Guardar cambios' : 'Crear registro'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
