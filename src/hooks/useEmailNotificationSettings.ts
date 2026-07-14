import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('useEmailNotificationSettings');

export interface EmailNotificationSettings {
  id?: string;
  emailEnabled: boolean;
  sendInspectionCompleted: boolean;
  sendVehiclePickup: boolean;
}

const defaultSettings: EmailNotificationSettings = {
  emailEnabled: true,
  sendInspectionCompleted: true,
  sendVehiclePickup: true,
};

const toDbPayload = (settings: EmailNotificationSettings) => ({
  email_enabled: settings.emailEnabled,
  send_inspection_completed: settings.sendInspectionCompleted,
  send_vehicle_pickup: settings.sendVehiclePickup,
});

export const useEmailNotificationSettings = () => {
  const [settings, setSettings] = useState<EmailNotificationSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('notification_email_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setSettings({
          id: data.id,
          emailEnabled: data.email_enabled ?? true,
          sendInspectionCompleted: data.send_inspection_completed ?? true,
          sendVehiclePickup: data.send_vehicle_pickup ?? true,
        });
      }
    } catch (error) {
      logger.error('Error fetching email notification settings:', error);
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
      const payload = toDbPayload(settings);
      const { error } = settings.id
        ? await (supabase as any).from('notification_email_settings').update(payload).eq('id', settings.id)
        : await (supabase as any).from('notification_email_settings').insert(payload);

      if (error) throw error;
      await fetchSettings();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || 'No se pudo guardar configuración de correo' };
    } finally {
      setSaving(false);
    }
  };

  const updateSettings = (partial: Partial<EmailNotificationSettings>) => {
    setSettings((current) => ({ ...current, ...partial }));
  };

  return {
    settings,
    loading,
    saving,
    updateSettings,
    saveSettings,
  };
};
