import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, Send } from 'lucide-react';
import { useSendExternalActaEmail } from '@/hooks/useExternalServiceClosure';
import { formatBusinessDateLong } from '@/utils/timezoneUtils';
import { toast } from 'sonner';

interface Props {
  serviceId: string;
  folio: string;
  emailSentTo: string[];
  emailSentAt: string | null;
  emailSendCount: number;
  defaultEmail?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const SendExternalActaDialog = ({
  serviceId, folio, emailSentTo, emailSentAt, emailSendCount, defaultEmail, open, onOpenChange,
}: Props) => {
  const [email, setEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const send = useSendExternalActaEmail();

  useEffect(() => {
    if (open) {
      setEmail(defaultEmail ?? '');
      setRecipientName('');
    }
  }, [open, defaultEmail]);

  const handleSend = async () => {
    if (!EMAIL_RE.test(email)) {
      toast.error('Ingresa un email válido');
      return;
    }
    await send.mutateAsync({ serviceId, recipientEmail: email, recipientName });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="size-5 text-purple-600" />
            Enviar Acta por email
          </DialogTitle>
          <DialogDescription>Folio {folio} · El destinatario recibirá el PDF adjunto.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <Label>Email destinatario *</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="cliente@empresa.cl"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Nombre del destinatario (opcional)</Label>
            <Input
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="Nombre que aparecerá en el saludo del email"
              className="mt-1"
            />
          </div>
          {emailSendCount > 0 && (
            <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{emailSendCount} envío(s)</Badge>
                {emailSentAt && <span className="text-muted-foreground">Último: {formatBusinessDateLong(emailSentAt)}</span>}
              </div>
              {emailSentTo.length > 0 && (
                <div className="text-muted-foreground">
                  Enviado a: {emailSentTo.join(', ')}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={send.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSend} disabled={send.isPending || !email} className="bg-purple-600 hover:bg-purple-700">
            <Send className="size-4 mr-2" />
            {send.isPending ? 'Enviando...' : 'Enviar Acta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
