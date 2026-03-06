
import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { usePurchaseInvoices } from '@/hooks/usePurchaseInvoices';
import { SupplierInvoiceWithDetails } from '@/types/suppliers';
import { format, parse } from 'date-fns';
import DatePickerInput from '@/components/common/DatePickerInput';

const invoiceSchema = z.object({
  invoice_number: z.string().min(1, 'El número de factura es requerido'),
  issue_date: z.date({ required_error: 'La fecha de emisión es requerida' }),
  due_date: z.date({ required_error: 'La fecha de vencimiento es requerida' }),
  amount: z.coerce.number().min(0, 'El monto debe ser mayor o igual a 0'),
  net_amount: z.coerce.number().min(0, 'El monto neto debe ser mayor o igual a 0'),
  tax_amount: z.coerce.number().min(0, 'El IVA debe ser mayor o igual a 0'),
  status: z.string().min(1, 'El estado es requerido'),
  description: z.string().optional(),
});

type InvoiceFormValues = z.infer<typeof invoiceSchema>;

interface EditHistoricalPurchaseModalProps {
  invoice: SupplierInvoiceWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EditHistoricalPurchaseModal: React.FC<EditHistoricalPurchaseModalProps> = ({
  invoice,
  open,
  onOpenChange,
}) => {
  const { updateInvoiceMutation } = usePurchaseInvoices();
  
  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      invoice_number: '',
      amount: 0,
      net_amount: 0,
      tax_amount: 0,
      status: 'pending',
      description: '',
    },
  });

  React.useEffect(() => {
    if (invoice && open) {
      form.reset({
        invoice_number: invoice.invoice_number,
        issue_date: new Date(invoice.issue_date),
        due_date: new Date(invoice.due_date),
        amount: invoice.amount,
        net_amount: invoice.net_amount,
        tax_amount: invoice.tax_amount || 0,
        status: invoice.status || 'pending',
        description: invoice.description || '',
      });
    }
  }, [invoice, open, form]);

  const onSubmit = async (data: InvoiceFormValues) => {
    if (!invoice) return;

    try {
      await updateInvoiceMutation.mutateAsync({
        id: invoice.id,
        data: {
          invoice_number: data.invoice_number,
          issue_date: data.issue_date.toISOString(),
          due_date: data.due_date.toISOString(),
          amount: data.amount,
          net_amount: data.net_amount,
          tax_amount: data.tax_amount,
          status: data.status,
          description: data.description,
        },
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating invoice:', error);
    }
  };

  const calculateAmounts = (field: 'amount' | 'net') => {
    const values = form.getValues();
    if (field === 'net' && values.net_amount > 0) {
      const tax = Math.round(values.net_amount * 0.19);
      form.setValue('tax_amount', tax);
      form.setValue('amount', values.net_amount + tax);
    } else if (field === 'amount' && values.amount > 0) {
      const net = Math.round(values.amount / 1.19);
      form.setValue('net_amount', net);
      form.setValue('tax_amount', values.amount - net);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Editar Factura de Compra</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="invoice_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>N° Factura</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione estado" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pending">Pendiente</SelectItem>
                        <SelectItem value="paid">Pagada</SelectItem>
                        <SelectItem value="overdue">Vencida</SelectItem>
                        <SelectItem value="cancelled">Anulada</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="issue_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha Emisión</FormLabel>
                    <FormControl>
                      <DatePickerInput
                        value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                        onChange={(val) => {
                          if (val) {
                            const d = parse(val, 'yyyy-MM-dd', new Date());
                            field.onChange(d);
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="due_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha Vencimiento</FormLabel>
                    <FormControl>
                      <DatePickerInput
                        value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                        onChange={(val) => {
                          if (val) {
                            const d = parse(val, 'yyyy-MM-dd', new Date());
                            field.onChange(d);
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="net_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Neto</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        {...field} 
                        onChange={e => {
                          field.onChange(e);
                        }}
                        onBlur={() => calculateAmounts('net')}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tax_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>IVA</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        {...field} 
                        onChange={e => {
                          field.onChange(e);
                        }}
                        onBlur={() => calculateAmounts('amount')}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción / Observaciones</FormLabel>
                  <FormControl>
                    <Textarea {...field} className="resize-none" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                Guardar Cambios
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
