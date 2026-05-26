import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface WhatsAppSettings {
  id?: string;
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
}

const defaultSettings: WhatsAppSettings = {
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
};

export const useWhatsAppSettings = () => {
  const [settings, setSettings] = useState<WhatsAppSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'ok' | 'error'>('unknown');
  const [testingSend, setTestingSend] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('whatsapp_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings({
          id: data.id,
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
        });
      }
    } catch (error) {
      console.error('Error fetching WhatsApp settings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const saveSettings = async (): Promise<{ success: boolean; error?: string }> => {
    setSaving(true);
    try {
      const payload = {
        admin_phone_1: settings.adminPhone1 || null,
        admin_phone_2: settings.adminPhone2 || null,
        notify_operator_assigned: settings.notifyOperatorAssigned,
        notify_service_completed: settings.notifyServiceCompleted,
        notify_document_expiry: settings.notifyDocumentExpiry,
        notify_payment_pending: settings.notifyPaymentPending,
        notify_service_no_quote: settings.notifyServiceNoQuote,
        notify_service_no_operator: settings.notifyServiceNoOperator,
        notify_invoice_overdue: settings.notifyInvoiceOverdue,
        notify_daily_reminder: settings.notifyDailyReminder,
      };

      let error;
      if (settings.id) {
        ({ error } = await (supabase as any)
          .from('whatsapp_settings')
          .update(payload)
          .eq('id', settings.id));
      } else {
        ({ error } = await (supabase as any)
          .from('whatsapp_settings')
          .insert(payload));
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
            anio: new Date().getFullYear().toString(),
            totalServicios: '1',
            totalIngresos: '0',
          },
          testMode: true,
          testPhone: settings.adminPhone1,
        },
      });

      if (error) throw error;
      setConnectionStatus('ok');
      toast.success('Mensaje de prueba enviado correctamente');
    } catch (error: any) {
      setConnectionStatus('error');
      toast.error('No se pudo enviar el mensaje de prueba', {
        description: error.message,
      });
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
    testingSend,
    updateSettings,
    saveSettings,
    sendTestMessage,
  };
};