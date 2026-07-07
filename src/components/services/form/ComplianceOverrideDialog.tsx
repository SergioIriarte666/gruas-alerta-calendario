import { useEffect, useState } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ComplianceIssue, formatComplianceIssueMessage } from '@/hooks/services/useResourceCompliance';

interface ComplianceOverrideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issues: ComplianceIssue[];
  isSubmitting?: boolean;
  onConfirm: (reason: string) => Promise<void>;
}

export const ComplianceOverrideDialog = ({
  open,
  onOpenChange,
  issues,
  isSubmitting = false,
  onConfirm,
}: ComplianceOverrideDialogProps) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      setReason('');
      setError('');
    }
  }, [open]);

  const handleConfirm = async () => {
    const trimmedReason = reason.trim();

    if (trimmedReason.length < 10) {
      setError('El motivo de la autorización debe tener al menos 10 caracteres.');
      return;
    }

    setError('');
    await onConfirm(trimmedReason);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Recursos no aptos para la fecha del servicio</AlertDialogTitle>
          <AlertDialogDescription>
            Se detectaron recursos con incumplimientos que bloquean la asignación para la fecha seleccionada.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            {issues.map((issue) => (
              <p key={`${issue.resource_type}-${issue.resource_id}-${issue.item}`} className="text-sm text-foreground">
                {formatComplianceIssueMessage(issue)}
              </p>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="compliance-override-reason">Motivo de la autorización</Label>
            <Textarea
              id="compliance-override-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Describe por qué se autoriza esta asignación excepcional"
              rows={4}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
          <Button variant="destructive" onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? 'Autorizando...' : 'Autorizar y guardar'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
