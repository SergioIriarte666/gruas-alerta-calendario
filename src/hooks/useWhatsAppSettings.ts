import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { createLogger } from "@/lib/logger";
import { businessClock } from '@/utils/businessClock';


const logger = createLogger("useWhatsAppSettings");
export interface WhatsAppSettings {
  id?: string;
  whatsappEnabled: boolean;
  adminPhone1: string;
  adminPhone2: string;
  notifyOperatorAssigned: boolean;
  notifyServiceCompleted: boolean;
  notifyDocumentExpiry: boolean;
  notifyPaymentPending: boolean;
  notifyServiceNoQuote: boolean;
  notifyServiceNoOperator: boolean;
  notifyInvoiceOverdue: boolean;
  notifyDailyReminder: boolean;
  notifyVehiclePickup: boolean;
}

const defaultSettings: WhatsAppSettings = {
  whatsappEnabled: true,
  adminPhone1: '',
  adminPhone2: '',
  notifyOperatorAssigned: true,
  notifyServiceCompleted: true,
  notifyDocumentExpiry: true,
  notifyPaymentPending: true,
  notifyServiceNoQuote: true,
  notifyServiceNoOperator: false,
  notifyInvoiceOverdue: false,
  notifyDailyReminder: false,
  notifyVehiclePickup: true,
};

const isMissingWhatsappEnabledColumn = (error: unknown): boolean => {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: unknown }).message ?? '')
        : '';

  return (
    message.includes('whatsapp_enabled') &&
    (message.includes('schema cache') || message.includes('Could not find'))
  );
};

const buildNotificationPayload = (currentSettings: WhatsAppSettings, forceDisableAll = false) => ({
  admin_phone_1: currentSettings.adminPhone1 || null,
  admin_phone_2: currentSettings.adminPhone2 || null,
  notify_operator_assigned: forceDisableAll ? false : currentSettings.notifyOperatorAssigned,
  notify_service_completed: forceDisableAll ? false : currentSettings.notifyServiceCompleted,
  notify_document_expiry: forceDisableAll ? false : currentSettings.notifyDocumentExpiry,
  notify_payment_pending: forceDisableAll ? false : currentSettings.notifyPaymentPending,
  notify_service_no_quote: forceDisableAll ? false : currentSettings.notifyServiceNoQuote,
  notify_service_no_operator: forceDisableAll ? false : currentSettings.notifyServiceNoOperator,
  notify_invoice_overdue: forceDisableAll ? false : currentSettings.notifyInvoiceOverdue,
  notify_daily_reminder: forceDisableAll ? false : currentSettings.notifyDailyReminder,
  notify_vehicle_pickup: forceDisableAll ? false : currentSettings.notifyVehiclePickup,
});

export const useWhatsAppSettings = () => {
  const [settings, setSettings] = useState<WhatsAppSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'ok' | 'error'>('unknown');
  const [lastError, setLastError] = useState<string | null>(null);
  const [testingSend, setTestingSend] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('whatsapp_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const derivedWhatsappEnabled =
          typeof data.whatsapp_enabled === 'boolean'
            ? data.whatsapp_enabled
            : Boolean(
                data.notify_operator_assigned ??
                  data.notify_service_completed ??
                  data.notify_document_expiry ??
                  data.notify_payment_pending ??
                  data.notify_service_no_quote ??
                  data.notify_service_no_operator ??
                  data.notify_invoice_overdue ??
                  data.notify_daily_reminder ??
                  data.notify_vehicle_pickup ??
                  true
              );

        setSettings({
          id: data.id,
          whatsappEnabled: derivedWhatsappEnabled,
          adminPhone1: data.admin_phone_1 || '',
          adminPhone2: data.admin_phone_2 || '',
          notifyOperatorAssigned: data.notify_operator_assigned ?? true,
          notifyServiceCompleted: data.notify_service_completed ?? true,
          notifyDocumentExpiry: data.notify_document_expiry ?? true,
          notifyPaymentPending: data.notify_payment_pending ?? true,
          notifyServiceNoQuote: data.notify_service_no_quote ?? true,
          notifyServiceNoOperator: data.notify_service_no_operator ?? false,
          notifyInvoiceOverdue: data.notify_invoice_overdue ?? false,
          notifyDailyReminder: data.notify_daily_reminder ?? false,
          notifyVehiclePickup: data.notify_vehicle_pickup ?? true,
        });
      }
    } catch (error) {
      logger.error('Error fetching WhatsApp settings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const saveSettings = async (): Promise<{ success: boolean; error?: string; compatibilityMode?: boolean }> => {
    setSaving(true);
    try {
      const basePayload = buildNotificationPayload(settings);
      const payload = {
        ...basePayload,
        whatsapp_enabled: settings.whatsappEnabled,
      };

      let error = null;
      if (settings.id) {
        ({ error } = await supabase
          .from('whatsapp_settings')
          .update(payload)
          .eq('id', settings.id));
      } else {
        ({ error } = await supabase
          .from('whatsapp_settings')
          .insert(payload));
      }

      if (error && isMissingWhatsappEnabledColumn(error)) {
        const compatibilityPayload = buildNotificationPayload(
          settings,
          !settings.whatsappEnabled
        );

        if (settings.id) {
          ({ error } = await supabase
            .from('whatsapp_settings')
            .update(compatibilityPayload)
            .eq('id', settings.id));
        } else {
          ({ error } = await supabase
            .from('whatsapp_settings')
            .insert(compatibilityPayload));
        }

        if (!error) {
          await fetchSettings();
          return { success: true, compatibilityMode: true };
        }
      }

      if (error) throw error;
      await fetchSettings();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    } finally {
      setSaving(false);
    }
  };

  const sendTestMessage = async (): Promise<void> => {
    if (!settings.adminPhone1) {
      toast.error('Ingresa al menos un número de administrador para hacer la prueba');
      return;
    }
    setTestingSend(true);
    try {
      const { error } = await supabase.functions.invoke('send-whatsapp-admin', {
        body: {
          event: 'cierre_mensual',
          data: {
            mes: 'Mayo',
            anio: businessClock.todayDate().getFullYear().toString(),
            totalServicios: '1',
            totalIngresos: '0',
          },
          testMode: true,
          testPhone: settings.adminPhone1,
        },
      });

      if (error) throw error;
      setConnectionStatus('ok');
      setLastError(null);
      toast.success('Mensaje de prueba enviado correctamente');
    } catch (error: any) {
      setConnectionStatus('error');
      const msg = error?.context?.error?.message || error?.message || 'Error desconocido';
      setLastError(msg);
      toast.error('No se pudo enviar el mensaje de prueba', { description: msg });
    } finally {
      setTestingSend(false);
    }
  };

  const updateSettings = (partial: Partial<WhatsAppSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  };

  return {
    settings,
    loading,
    saving,
    connectionStatus,
    lastError,
    testingSend,
    updateSettings,
    saveSettings,
    sendTestMessage,
  };
};
