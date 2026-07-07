import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { BellOff } from 'lucide-react';

interface AlertAcknowledgementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  isSubmitting?: boolean;
  onConfirm: (notes: string) => Promise<void>;
}

export const AlertAcknowledgementDialog = ({
  open,
  onOpenChange,
  title,
  description,
  isSubmitting = false,
  onConfirm,
}: AlertAcknowledgementDialogProps) => {
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) {
      setNotes('');
    }
  }, [open]);

  const handleConfirm = async () => {
    await onConfirm(notes);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border/70 bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BellOff className="size-5 text-muted-foreground" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{description}</p>
          <div className="space-y-2">
            <Label htmlFor="alert-ack-notes">Nota interna</Label>
            <Textarea
              id="alert-ack-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              placeholder="Opcional: detalle de la gestión o seguimiento"
            />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? 'Silenciando...' : 'Silenciar alerta'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
