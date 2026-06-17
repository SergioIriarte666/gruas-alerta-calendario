import { businessClock } from '@/utils/businessClock';
import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSuppliers } from '@/hooks/useSuppliers';
import DatePickerInput from '@/components/common/DatePickerInput';
import { Loader2 } from 'lucide-react';
import { format, parse } from 'date-fns';
import { createLogger } from "@/lib/logger";


const logger = createLogger("CreateHistoricalPurchaseModal");
const purchaseSchema = z.object({
  supplier_id: z.string().min(1, 'El proveedor es requerido'),
  invoice_number: z.string().min(1, 'El número de factura es requerido'),
  issue_date: z.date({ required_error: 'La fecha de emisión es requerida' }),
  due_date: z.date({ required_error: 'La fecha de vencimiento es requerida' }),
  net_amount: z.coerce.number().min(0, 'El monto neto no puede ser negativo'),
  tax_amount: z.coerce.number().min(0, 'El IVA no puede ser negativo'),
  amount: z.coerce.number().min(0, 'El monto total no puede ser negativo'),
  status: z.enum(['pending', 'paid', 'overdue', 'cancelled']),
  product_service_description: z.string().trim().min(10, 'Debe tener al menos 10 caracteres').max(500, 'Debe tener máximo 500 caracteres'),
});

type PurchaseFormValues = z.infer<typeof purchaseSchema>;

interface CreateHistoricalPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}

export const CreateHistoricalPurchaseModal = ({
  isOpen,
  onClose,
  onSave,
}: CreateHistoricalPurchaseModalProps) => {
  const { suppliers, isLoading: isLoadingSuppliers } = useSuppliers();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<PurchaseFormValues>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: {
      supplier_id: '',
      invoice_number: '',
      issue_date: businessClock.now(),
      due_date: businessClock.now(),
      net_amount: 0,
      tax_amount: 0,
      amount: 0,
      status: 'pending',
      product_service_description: '',
    },
  });

  const { control, handleSubmit, watch, setValue, formState: { errors } } = form;
  const netAmount = watch('net_amount');
  const taxAmount = watch('tax_amount');

  // Auto-calculate total amount when net or tax changes
  useEffect(() => {
    const total = (parseFloat(netAmount?.toString() || '0') + parseFloat(taxAmount?.toString() || '0'));
    setValue('amount', total);
  }, [netAmount, taxAmount, setValue]);

  const onSubmit = async (data: PurchaseFormValues) => {
    setIsSubmitting(true);
    try {
      await onSave({
        ...data,
        issue_date: format(data.issue_date, 'yyyy-MM-dd'),
        due_date: format(data.due_date, 'yyyy-MM-dd'),
        description: data.product_service_description,
      });
      form.reset();
      onClose();
    } catch (error) {
      logger.error('Error creating purchase invoice:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Nueva Factura de Compra</DialogTitle>
          <DialogDescription>
            Ingresa los detalles de la nueva factura de compra.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supplier_id">Proveedor</Label>
              <Controller
                name="supplier_id"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar proveedor" />
                    </SelectTrigger>
                    <SelectContent>
                      {isLoadingSuppliers ? (
                        <SelectItem value="loading" disabled>Cargando...</SelectItem>
                      ) : (
                        suppliers.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.supplier_id && (
                <p className="text-sm text-red-500">{errors.supplier_id.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoice_number">Nº Factura</Label>
              <Input
                id="invoice_number"
                {...form.register('invoice_number')}
                placeholder="Ej: 123456"
              />
              {errors.invoice_number && (
                <p className="text-sm text-red-500">{errors.invoice_number.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fecha de Emisión</Label>
              <Controller
                name="issue_date"
                control={control}
                render={({ field }) => (
                  <DatePickerInput
                    value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                    onChange={(val) => field.onChange(val ? parse(val, 'yyyy-MM-dd', new Date()) : undefined)}
                  />
                )}
              />
              {errors.issue_date && (
                <p className="text-sm text-red-500">{errors.issue_date.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Fecha de Vencimiento</Label>
              <Controller
                name="due_date"
                control={control}
                render={({ field }) => (
                  <DatePickerInput
                    value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                    onChange={(val) => field.onChange(val ? parse(val, 'yyyy-MM-dd', new Date()) : undefined)}
                  />
                )}
              />
              {errors.due_date && (
                <p className="text-sm text-red-500">{errors.due_date.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="net_amount">Monto Neto</Label>
              <Input
                id="net_amount"
                type="number"
                {...form.register('net_amount')}
              />
              {errors.net_amount && (
                <p className="text-sm text-red-500">{errors.net_amount.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="tax_amount">IVA</Label>
              <Input
                id="tax_amount"
                type="number"
                {...form.register('tax_amount')}
              />
              {errors.tax_amount && (
                <p className="text-sm text-red-500">{errors.tax_amount.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Monto Total</Label>
              <Input
                id="amount"
                type="number"
                {...form.register('amount')}
              />
              {errors.amount && (
                <p className="text-sm text-red-500">{errors.amount.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Estado</Label>
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="paid">Pagada</SelectItem>
                    <SelectItem value="overdue">Vencida</SelectItem>
                    <SelectItem value="cancelled">Anulada</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            {errors.status && (
              <p className="text-sm text-red-500">{errors.status.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="product_service_description">Descripción de Producto o Servicio</Label>
            <Textarea
              id="product_service_description"
              {...form.register('product_service_description')}
              placeholder="Describe el motivo o razón que originó la creación del documento..."
              className="resize-none"
              rows={4}
            />
            {errors.product_service_description && (
              <p className="text-sm text-red-500">{errors.product_service_description.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Creando...
                </>
              ) : (
                'Crear Factura'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
