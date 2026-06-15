import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { Service } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { logUserActivity } from '@/utils/activityLog';

interface UseOperatorNotificationFlowParams {
  onComplete: (service: Service) => void;
}

interface NotificationContext {
  service: Service;
  operatorId: string;
}

const getNotificationPayload = (service: Service, operatorId: string, force = false) => ({
  operatorId,
  serviceId: service.id,
  folio: service.folio,
  vehicleBrand: service.vehicleBrand || '',
  vehicleModel: service.vehicleModel || '',
  licensePlate: service.licensePlate || '',
  clientName: service.client?.name || '',
  clientPhone: service.client?.phone || '',
  contactPerson: service.contactPerson || '',
  contactPhone: service.contactPhone || '',
  serviceDate: service.serviceDate,
  origin: service.origin || '',
  destination: service.destination || '',
  force,
});

export const useOperatorNotificationFlow = ({
  onComplete,
}: UseOperatorNotificationFlowParams) => {
  const { user } = useUser();
  const [context, setContext] = useState<NotificationContext | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [retryOpen, setRetryOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const completeFlow = useCallback((service?: Service) => {
    const resolvedService = service ?? context?.service;
    setConfirmOpen(false);
    setRetryOpen(false);
    setContext(null);

    if (resolvedService) {
      onComplete(resolvedService);
    }
  }, [context?.service, onComplete]);

  const registerActivity = useCallback(async (eventType: string, service: Service) => {
    if (!user?.id) return;

    try {
      await logUserActivity({
        userId: user.id,
        eventType,
        path: window.location.pathname,
        metadata: {
          serviceId: service.id,
          serviceFolio: service.folio,
          operatorId: context?.operatorId || null,
        },
      });
    } catch {
      // Non-blocking audit trail
    }
  }, [context?.operatorId, user?.id]);

  const sendNotification = useCallback(async (force = false) => {
    if (!context) return;

    setIsSending(true);
    try {
      const { service, operatorId } = context;
      const { data, error } = await supabase.functions.invoke('send-whatsapp-operator', {
        body: getNotificationPayload(service, operatorId, force),
      });

      if (error) {
        await registerActivity('service_operator_whatsapp_failed', service);
        setConfirmOpen(false);
        setRetryOpen(true);
        return;
      }

      if ((data as any)?.skipped) {
        const reason = (data as any)?.reason;

        if (reason === 'whatsapp_disabled') {
          toast.warning('Envío de WhatsApp deshabilitado en Configuración');
        } else {
          toast.info('WhatsApp al operador omitido', {
            description: reason || 'Envío omitido por configuración',
          });
        }

        await registerActivity('service_operator_whatsapp_skipped', service);
        completeFlow(service);
        return;
      }

      const errorCode = (data as any)?.error?.code;
      if (errorCode === 'NO_PHONE') {
        toast.warning('WhatsApp al operador omitido', {
          description: 'El operador asignado no tiene teléfono configurado.',
        });
        await registerActivity('service_operator_whatsapp_skipped_no_phone', service);
        completeFlow(service);
        return;
      }

      if (errorCode === 'INVALID_PHONE') {
        toast.warning('WhatsApp al operador omitido', {
          description: 'El teléfono del operador no tiene un formato válido.',
        });
        await registerActivity('service_operator_whatsapp_skipped_invalid_phone', service);
        completeFlow(service);
        return;
      }

      toast.success('Operador notificado por WhatsApp');
      await registerActivity('service_operator_whatsapp_sent', service);
      completeFlow(service);
    } catch {
      if (context) {
        await registerActivity('service_operator_whatsapp_failed', context.service);
      }
      setConfirmOpen(false);
      setRetryOpen(true);
    } finally {
      setIsSending(false);
    }
  }, [completeFlow, context, registerActivity]);

  const openNotificationPrompt = useCallback((service: Service, operatorId: string | null) => {
    if (!operatorId) {
      toast.info('Servicio creado sin operador asignado. No se envió WhatsApp al operador.');
      completeFlow(service);
      return;
    }

    setContext({ service, operatorId });
    setRetryOpen(false);
    setConfirmOpen(true);
  }, [completeFlow]);

  const declineNotification = useCallback(async () => {
    if (!context) return;

    await registerActivity('service_operator_whatsapp_declined', context.service);
    completeFlow(context.service);
  }, [completeFlow, context, registerActivity]);

  const cancelRetry = useCallback(async () => {
    if (!context) return;

    await registerActivity('service_operator_whatsapp_retry_cancelled', context.service);
    completeFlow(context.service);
  }, [completeFlow, context, registerActivity]);

  return {
    confirmOpen,
    retryOpen,
    isSending,
    openNotificationPrompt,
    confirmNotification: () => sendNotification(false),
    retryNotification: () => sendNotification(true),
    declineNotification,
    cancelRetry,
  };
};
