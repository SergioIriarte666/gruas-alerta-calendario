import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { BellOff, BellRing, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { cn } from '@/lib/utils';

const logger = createLogger('ClientNotificationsToggle');

interface ClientNotificationsToggleProps {
  serviceId: string;
  /** Valor conocido al abrir el detalle; se reconfirma contra la base. */
  initialEnabled?: boolean | null;
  className?: string;
}

/**
 * Interruptor de los canales automáticos HACIA EL CLIENTE, por servicio.
 *
 * Apagado por defecto y de forma deliberada. Hasta ahora lo que impedía
 * escribirle a un cliente real desde un servicio de prueba eran los datos
 * placeholder; el 25/07 un correo salió igual hacia un dominio con error de
 * tipeo. Un cortafuegos tiene que ser de diseño.
 *
 * Los canales internos —avisos a operadores y al admin, incluido el watchdog de
 * telemetría— NO pasan por aquí: apagar la voz hacia afuera no puede dejar
 * ciega a la operación.
 */
export const ClientNotificationsToggle = ({
  serviceId,
  initialEnabled = null,
  className,
}: ClientNotificationsToggleProps) => {
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState<boolean | null>(initialEnabled);
  const [isSaving, setIsSaving] = useState(false);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from('services')
      .select('client_notifications_enabled')
      .eq('id', serviceId)
      .maybeSingle();

    if (error) {
      logger.warn('No se pudo leer el interruptor de notificaciones', error);
      return;
    }
    setEnabled((data as { client_notifications_enabled?: boolean } | null)?.client_notifications_enabled === true);
  }, [serviceId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const handleChange = async (next: boolean) => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('services')
        .update({ client_notifications_enabled: next } as never)
        .eq('id', serviceId);

      if (error) throw new Error(error.message);

      // Confirmación por re-lectura, igual que el PIN del operador: el estado
      // que enciende envíos a terceros no se da por bueno con el optimismo del
      // cliente.
      await refresh();
      await queryClient.invalidateQueries({ queryKey: ['service-change-history', serviceId] });
      toast.success(next
        ? 'Notificaciones al cliente activadas'
        : 'Notificaciones al cliente desactivadas');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo cambiar el interruptor';
      logger.warn('No se pudo cambiar el interruptor de notificaciones', error);
      toast.error(message);
      void refresh();
    } finally {
      setIsSaving(false);
    }
  };

  const isOn = enabled === true;

  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-md border px-3 py-1.5',
        isOn ? 'border-success/30 bg-success-soft' : 'border-border bg-muted/40',
        className,
      )}
    >
      {isSaving
        ? <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
        : isOn
          ? <BellRing className="size-4 shrink-0 text-success-text" />
          : <BellOff className="size-4 shrink-0 text-muted-foreground" />}
      <Label
        htmlFor={`client-notifications-${serviceId}`}
        className="cursor-pointer whitespace-nowrap text-sm font-medium"
      >
        Notificaciones al cliente
      </Label>
      <Switch
        id={`client-notifications-${serviceId}`}
        checked={isOn}
        disabled={isSaving || enabled === null}
        onCheckedChange={(next) => void handleChange(next)}
        aria-describedby={`client-notifications-hint-${serviceId}`}
      />
      <span id={`client-notifications-hint-${serviceId}`} className="sr-only">
        Cuando está apagado, ningún canal automático (link de seguimiento, correo o WhatsApp de
        inspección y entrega) sale hacia el cliente de este servicio.
      </span>
    </div>
  );
};
