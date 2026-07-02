import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ServiceDispute } from '@/types';
import { DISPUTE_TYPE_LABELS } from '@/utils/serviceDisputeUtils';
import { useServiceDisputeActions } from '@/hooks/services/useServiceDisputes';
import { createLogger } from '@/lib/logger';

const logger = createLogger('ServiceDisputes');

const formSchema = z.object({
  resolutionNotes: z.string().min(1, 'Las notas de resolución son requeridas'),
});

type FormValues = z.infer<typeof formSchema>;

interface ResolveServiceDisputeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dispute: ServiceDispute | null;
  serviceFolio?: string;
  onResolved?: () => void;
}

export const ResolveServiceDisputeModal = ({
  open,
  onOpenChange,
  dispute,
  serviceFolio,
  onResolved,
}: ResolveServiceDisputeModalProps) => {
  const { resolveDispute } = useServiceDisputeActions();
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { resolutionNotes: '' },
  });

  useEffect(() => {
    if (open) reset({ resolutionNotes: '' });
  }, [open, reset]);

  const onSubmit = async (data: FormValues) => {
    if (!dispute) return;
    setSubmitting(true);
    try {
      await resolveDispute(dispute.id, dispute.serviceId, data.resolutionNotes);
      onOpenChange(false);
      onResolved?.();
    } catch (error) {
      logger.error('Error resolving dispute from modal:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <CheckCircle2 className="size-5 text-emerald-500" />
            Resolver disputa {serviceFolio ? `— ${serviceFolio}` : ''}
          </DialogTitle>
        </DialogHeader>

        {dispute && (
          <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
            <div className="font-medium text-foreground">{DISPUTE_TYPE_LABELS[dispute.disputeType]}</div>
            <div className="text-muted-foreground">{dispute.description}</div>
            {dispute.referenceDoc && (
              <div className="text-muted-foreground">Referencia: {dispute.referenceDoc}</div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label className="text-foreground">Notas de resolución</Label>
            <Textarea
              {...register('resolutionNotes')}
              placeholder="Describe cómo se resolvió la disputa"
              className="mt-1"
              rows={3}
            />
            {errors.resolutionNotes && (
              <p className="text-sm text-destructive mt-1">{errors.resolutionNotes.message}</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting} className="gap-2">
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Resolver
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
