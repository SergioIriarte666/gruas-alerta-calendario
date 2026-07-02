import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DisputeType } from '@/types';
import { DISPUTE_TYPE_OPTIONS } from '@/utils/serviceDisputeUtils';
import { useServiceDisputeActions } from '@/hooks/services/useServiceDisputes';
import { createLogger } from '@/lib/logger';

const logger = createLogger('ServiceDisputes');

const formSchema = z.object({
  disputeType: z.enum(['item_faltante_oc', 'patente_incorrecta', 'monto_distinto', 'documento_faltante', 'otro'] as const),
  description: z.string().min(1, 'La descripción es requerida'),
  disputedAmount: z.string().optional(),
  referenceDoc: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface MarkServiceDisputeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceId: string;
  serviceFolio?: string;
  onMarked?: () => void;
}

export const MarkServiceDisputeModal = ({
  open,
  onOpenChange,
  serviceId,
  serviceFolio,
  onMarked,
}: MarkServiceDisputeModalProps) => {
  const { markDispute } = useServiceDisputeActions();
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { disputeType: 'otro', description: '', disputedAmount: '', referenceDoc: '' },
  });

  useEffect(() => {
    if (open) {
      reset({ disputeType: 'otro', description: '', disputedAmount: '', referenceDoc: '' });
    }
  }, [open, reset]);

  const onSubmit = async (data: FormValues) => {
    setSubmitting(true);
    try {
      await markDispute({
        serviceId,
        disputeType: data.disputeType,
        description: data.description,
        disputedAmount: data.disputedAmount ? Number(data.disputedAmount) : undefined,
        referenceDoc: data.referenceDoc || undefined,
      });
      onOpenChange(false);
      onMarked?.();
    } catch (error) {
      logger.error('Error marking dispute from modal:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <AlertTriangle className="size-5 text-amber-500" />
            Marcar en disputa {serviceFolio ? `— ${serviceFolio}` : ''}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label className="text-foreground">Tipo de disputa</Label>
            <Select value={watch('disputeType')} onValueChange={(value: DisputeType) => setValue('disputeType', value)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DISPUTE_TYPE_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-foreground">Descripción</Label>
            <Textarea
              {...register('description')}
              placeholder="Ej: La OC no incluye el traslado de equipos adicional"
              className="mt-1"
              rows={3}
            />
            {errors.description && <p className="text-sm text-destructive mt-1">{errors.description.message}</p>}
          </div>

          <div>
            <Label className="text-foreground">Monto en disputa (opcional)</Label>
            <Input {...register('disputedAmount')} type="number" placeholder="Ej: 45000" className="mt-1" />
          </div>

          <div>
            <Label className="text-foreground">Documento de referencia (opcional)</Label>
            <Input {...register('referenceDoc')} placeholder="Ej: OC 4701732315" className="mt-1" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting} className="gap-2 bg-amber-600 hover:bg-amber-700 text-white">
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Marcar en disputa
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
