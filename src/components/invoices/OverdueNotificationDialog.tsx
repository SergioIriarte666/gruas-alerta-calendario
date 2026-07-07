import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { createLogger } from "@/lib/logger";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useClientBillingContacts } from '@/hooks/useClientBillingContacts';
import { Mail, Send, Loader2 } from 'lucide-react';

const logger = createLogger('OverdueNotification');

interface OverdueNotificationDialogProps {
  invoice: {
    id: string;
    folio: string;
  } | null;
  clientEmail: string;
  clientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const OverdueNotificationDialog = ({
  invoice,
  clientEmail,
  clientId,
  open,
  onOpenChange,
}: OverdueNotificationDialogProps) => {
  const queryClient = useQueryClient();
  const { contacts, isLoading: loadingContacts } = useClientBillingContacts(clientId);
  const activeContacts = contacts.filter(c => c.is_active);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open && clientEmail) {
      setSelected(new Set([clientEmail.toLowerCase().trim()]));
    }
  }, [open, clientEmail]);

  const toggle = useCallback((email: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(email)) {
        next.delete(email);
      } else {
        next.add(email);
      }
      return next;
    });
  }, []);

  const selectedCount = selected.size;

  const handleSend = async () => {
    if (!invoice || selectedCount === 0) return;

    setSending(true);
    try {
      const recipients = Array.from(selected);
      const result = await supabase.functions.invoke('send-invoice-overdue-notification', {
        body: {
          invoiceId: invoice.id,
          folio: invoice.folio,
          recipients,
        },
      });

      if (result.error) {
        const msg = typeof result.error === 'string'
          ? result.error
          : (result.error as any)?.message || 'Error desconocido';
        throw new Error(msg);
      }

      const data = result.data as any;
      const sentToCount = Array.isArray(data?.sentTo) ? data.sentTo.length : selectedCount;

      queryClient.invalidateQueries({ queryKey: ['invoice-email-log'] });
      toast.success('Notificacion enviada', {
        description: `Notificacion enviada a ${sentToCount} destinatario${sentToCount !== 1 ? 's' : ''}.`,
      });
      onOpenChange(false);
    } catch (error: any) {
      logger.error('Error sending overdue notification:', error);
      toast.error('Error al enviar notificacion', {
        description: error?.message || 'No se pudo enviar la notificacion de vencimiento.',
      });
    } finally {
      setSending(false);
    }
  };

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="size-5 text-danger" />
            Notificar vencimiento
          </DialogTitle>
          <DialogDescription>
            Selecciona los destinatarios para la factura <strong>{invoice.folio}</strong>.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-60">
          <div className="space-y-3 pr-2">
            {/* Email principal del cliente */}
            <div className="flex items-start gap-2 rounded-lg border border-border p-3">
              <Checkbox
                id={`rcpt-principal`}
                checked={selected.has(clientEmail.toLowerCase().trim())}
                onCheckedChange={() => toggle(clientEmail.toLowerCase().trim())}
              />
              <div className="flex-1 min-w-0">
                <Label
                  htmlFor={`rcpt-principal`}
                  className="text-sm font-medium cursor-pointer"
                >
                  {clientEmail}
                </Label>
                <p className="text-xs text-muted-foreground">(principal)</p>
              </div>
            </div>

            {/* Contactos activos */}
            {loadingContacts ? (
              <div className="text-center py-4 text-muted-foreground text-sm">
                Cargando contactos...
              </div>
            ) : activeContacts.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">
                Sin contactos de cobranza adicionales.
              </p>
            ) : (
              activeContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-start gap-2 rounded-lg border border-border p-3"
                >
                  <Checkbox
                    id={`rcpt-${contact.id}`}
                    checked={selected.has(contact.email.toLowerCase().trim())}
                    onCheckedChange={() => toggle(contact.email.toLowerCase().trim())}
                  />
                  <div className="flex-1 min-w-0">
                    <Label
                      htmlFor={`rcpt-${contact.id}`}
                      className="text-sm font-medium cursor-pointer"
                    >
                      {contact.name}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {contact.email}
                      {contact.position ? ` (${contact.position})` : ''}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <div className="flex items-center gap-2 w-full justify-between">
            <Badge variant="outline" className="text-xs">
              {selectedCount} seleccionado{selectedCount !== 1 ? 's' : ''}
            </Badge>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
                Cancelar
              </Button>
              <Button
                onClick={handleSend}
                disabled={selectedCount === 0 || sending}
                className="bg-danger hover:bg-danger/90"
              >
                {sending ? (
                  <>
                    <Loader2 className="size-4 mr-1 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="size-4 mr-1" />
                    Enviar
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
