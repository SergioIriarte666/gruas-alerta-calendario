import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNotifications } from '@/contexts/NotificationContext';
import { InvoiceAlertSettings, OverdueInvoice, InvoiceDueSoon } from '@/types/notifications';
import { createLogger } from "@/lib/logger";


const logger = createLogger("useInvoiceAlerts");
const INVOICE_ALERT_SETTINGS_SELECT = `
  id,
  user_id,
  overdue_alerts_enabled,
  due_soon_alerts_enabled,
  due_soon_days,
  email_notifications,
  push_notifications,
  created_at,
  updated_at
`;

export const useInvoiceAlerts = () => {
  const { addNotification } = useNotifications();
  const queryClient = useQueryClient();

  // Obtener facturas vencidas
  const { data: overdueInvoices, isLoading: loadingOverdue } = useQuery({
    queryKey: ['overdue-invoices'],
    queryFn: async (): Promise<OverdueInvoice[]> => {
      const { data, error } = await supabase.rpc('get_overdue_invoices_for_alerts');
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 5 * 60 * 1000, // Cada 5 minutos
  });

  // Obtener facturas próximas a vencer
  const { data: invoicesDueSoon, isLoading: loadingDueSoon } = useQuery({
    queryKey: ['invoices-due-soon'],
    queryFn: async (): Promise<InvoiceDueSoon[]> => {
      const { data, error } = await supabase.rpc('get_invoices_due_soon', { days_ahead: 7 });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60 * 60 * 1000, // Cada hora
  });

  // Obtener configuración de alertas
  const { data: alertSettings, isLoading: loadingSettings } = useQuery({
    queryKey: ['invoice-alert-settings'],
    queryFn: async (): Promise<InvoiceAlertSettings | null> => {
      const { data, error } = await supabase
        .from('invoice_alert_settings')
        .select(INVOICE_ALERT_SETTINGS_SELECT)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
  });

  // Actualizar configuración de alertas
  const updateAlertSettings = useMutation({
    mutationFn: async (settings: Partial<InvoiceAlertSettings>) => {
      const { data: existingSettings } = await supabase
        .from('invoice_alert_settings')
        .select('id')
        .maybeSingle();

      if (existingSettings) {
        const { data, error } = await supabase
          .from('invoice_alert_settings')
          .update({ ...settings, updated_at: new Date().toISOString() })
          .eq('id', existingSettings.id)
          .select(INVOICE_ALERT_SETTINGS_SELECT)
          .single();
        
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('invoice_alert_settings')
          .insert([{ ...settings, user_id: (await supabase.auth.getUser()).data.user?.id }])
          .select(INVOICE_ALERT_SETTINGS_SELECT)
          .single();
        
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-alert-settings'] });
      addNotification({
        title: 'Configuración Actualizada',
        message: 'Las configuraciones de alertas han sido guardadas exitosamente.',
        type: 'success',
      });
    },
    onError: (error) => {
      logger.error('Error updating alert settings:', error);
      addNotification({
        title: 'Error',
        message: 'No se pudo actualizar la configuración de alertas.',
        type: 'error',
      });
    },
  });

  // Forzar actualización de facturas vencidas
  const forceUpdateOverdueInvoices = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('update_overdue_invoices');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overdue-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoices-due-soon'] });
      addNotification({
        title: 'Actualización Completada',
        message: 'Se han actualizado los estados de las facturas vencidas.',
        type: 'success',
      });
    },
  });

  return {
    overdueInvoices: overdueInvoices || [],
    invoicesDueSoon: invoicesDueSoon || [],
    alertSettings: alertSettings || {
      overdue_alerts_enabled: true,
      due_soon_alerts_enabled: true,
      due_soon_days: 7,
      email_notifications: false,
      push_notifications: true,
    },
    loading: loadingOverdue || loadingDueSoon || loadingSettings,
    updateAlertSettings: updateAlertSettings.mutate,
    forceUpdateOverdueInvoices: forceUpdateOverdueInvoices.mutate,
    isUpdating: updateAlertSettings.isPending || forceUpdateOverdueInvoices.isPending,
  };
};
