import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { PaymentTerm } from '@/types';
import { usePaymentTerms } from '@/hooks/usePaymentTerms';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createLogger } from "@/lib/logger";


const logger = createLogger("PaymentTermFormModal");
const paymentTermSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  code: z.string().min(1, 'El código es requerido').regex(/^[a-z0-9_]+$/, 'Solo letras minúsculas, números y guiones bajos'),
  days: z.number().min(0, 'Los días deben ser mayor o igual a 0'),
  description: z.string().optional(),
  display_order: z.number().min(0),
});

type PaymentTermFormData = z.infer<typeof paymentTermSchema>;

interface PaymentTermFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingTerm: PaymentTerm | null;
}

export const PaymentTermFormModal = ({
  isOpen,
  onClose,
  editingTerm,
}: PaymentTermFormModalProps) => {
  const { createPaymentTerm, updatePaymentTerm } = usePaymentTerms();
  
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PaymentTermFormData>({
    resolver: zodResolver(paymentTermSchema),
    defaultValues: {
      name: '',
      code: '',
      days: 0,
      description: '',
      display_order: 0,
    },
  });

  useEffect(() => {
    if (editingTerm) {
      reset({
        name: editingTerm.name,
        code: editingTerm.code,
        days: editingTerm.days,
        description: editingTerm.description || '',
        display_order: editingTerm.display_order,
      });
    } else {
      reset({
        name: '',
        code: '',
        days: 0,
        description: '',
        display_order: 0,
      });
    }
  }, [editingTerm, reset]);

  const onSubmit = async (data: PaymentTermFormData) => {
    try {
      if (editingTerm) {
        await updatePaymentTerm(editingTerm.id, data);
      } else {
        await createPaymentTerm({
          name: data.name,
          code: data.code,
          days: data.days,
          description: data.description || undefined,
          is_active: true,
          display_order: data.display_order,
        });
      }
      onClose();
      reset();
    } catch (error) {
      logger.error('Error saving payment term:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editingTerm ? 'Editar Condición de Pago' : 'Nueva Condición de Pago'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre *</Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="Ej: Crédito 30 días"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="code">Código Único *</Label>
            <Input
              id="code"
              {...register('code')}
              placeholder="Ej: credit_30"
              disabled={!!editingTerm}
            />
            <p className="text-xs text-muted-foreground">
              Solo letras minúsculas, números y guiones bajos
            </p>
            {errors.code && (
              <p className="text-sm text-destructive">{errors.code.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="days">Días de Crédito *</Label>
            <Input
              id="days"
              type="number"
              {...register('days', { valueAsNumber: true })}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">
              0 para contado, mayor a 0 para crédito
            </p>
            {errors.days && (
              <p className="text-sm text-destructive">{errors.days.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción (Opcional)</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Descripción de la condición de pago"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="display_order">Orden de Visualización</Label>
            <Input
              id="display_order"
              type="number"
              {...register('display_order', { valueAsNumber: true })}
              placeholder="0"
            />
            {errors.display_order && (
              <p className="text-sm text-destructive">{errors.display_order.message}</p>
            )}
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? 'Guardando...'
                : editingTerm
                ? 'Actualizar'
                : 'Crear'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
