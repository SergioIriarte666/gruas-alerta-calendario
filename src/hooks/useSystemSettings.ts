
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { SystemSettings, NotificationSettings } from '@/types/settings';

interface SystemSettingsFromDB {
  id: string;
  auto_backup: boolean;
  backup_frequency: 'daily' | 'weekly' | 'monthly';
  data_retention: number;
  maintenance_mode: boolean;
  email_notifications: boolean;
  service_reminders: boolean;
  invoice_alerts: boolean;
  overdue_notifications: boolean;
  system_updates: boolean;
}

export const useSystemSettings = () => {
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    autoBackup: true,
    backupFrequency: 'daily',
    dataRetention: 12,
    maintenanceMode: false,
  });

  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    emailNotifications: true,
    serviceReminders: true,
    invoiceAlerts: true,
    overdueNotifications: true,
    systemUpdates: false,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (data) {
        setSystemSettings({
          autoBackup: data.auto_backup,
          backupFrequency: data.backup_frequency as 'daily' | 'weekly' | 'monthly',
          dataRetention: data.data_retention,
          maintenanceMode: data.maintenance_mode,
        });

        setNotificationSettings({
          emailNotifications: data.email_notifications,
          serviceReminders: data.service_reminders,
          invoiceAlerts: data.invoice_alerts,
          overdueNotifications: data.overdue_notifications,
          systemUpdates: data.system_updates,
        });
      }
    } catch (error) {
      console.error('Error fetching system settings:', error);
      toast.error('Error', {
        description: 'No se pudo cargar la configuración del sistema.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSystemSettings = (updates: Partial<SystemSettings>) => {
    setSystemSettings(prev => ({ ...prev, ...updates }));
  };

  const updateNotificationSettings = (updates: Partial<NotificationSettings>) => {
    setNotificationSettings(prev => ({ ...prev, ...updates }));
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const payload = {
        auto_backup: systemSettings.autoBackup,
        backup_frequency: systemSettings.backupFrequency,
        data_retention: systemSettings.dataRetention,
        maintenance_mode: systemSettings.maintenanceMode,
        email_notifications: notificationSettings.emailNotifications,
        service_reminders: notificationSettings.serviceReminders,
        invoice_alerts: notificationSettings.invoiceAlerts,
        overdue_notifications: notificationSettings.overdueNotifications,
        system_updates: notificationSettings.systemUpdates,
        updated_at: new Date().toISOString(),
      };

      // Verificar si ya existe una configuración
      const { data: existing } = await supabase
        .from('system_settings')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (existing) {
        // Actualizar configuración existente
        const { error } = await supabase
          .from('system_settings')
          .update(payload)
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Crear nueva configuración
        const { error } = await supabase
          .from('system_settings')
          .insert([payload]);

        if (error) throw error;
      }

      return { success: true };
    } catch (error) {
      console.error('Error saving system settings:', error);
      return { 
        success: false, 
        error: 'Error al guardar la configuración del sistema: ' + (error?.message || 'Desconocido') 
      };
    } finally {
      setSaving(false);
    }
  };

  return {
    systemSettings,
    notificationSettings,
    loading,
    saving,
    updateSystemSettings,
    updateNotificationSettings,
    saveSettings,
    refetch: fetchSettings,
  };
};
