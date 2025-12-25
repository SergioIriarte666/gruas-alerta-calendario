import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SessionSettings {
  enabled: boolean;
  warningMinutes: number;
  timeoutMinutes: number;
}

const DEFAULT_SETTINGS: SessionSettings = {
  enabled: true,
  warningMinutes: 25,
  timeoutMinutes: 30,
};

export const useSessionSettings = () => {
  const [settings, setSettings] = useState<SessionSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('session_timeout_enabled, session_warning_minutes, session_timeout_minutes')
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching session settings:', error);
        return;
      }

      if (data) {
        setSettings({
          enabled: data.session_timeout_enabled ?? true,
          warningMinutes: data.session_warning_minutes ?? 25,
          timeoutMinutes: data.session_timeout_minutes ?? 30,
        });
      }
    } catch (error) {
      console.error('Error in fetchSettings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();

    // Escuchar cambios en la configuración
    const handleSettingsUpdate = () => {
      fetchSettings();
    };

    window.addEventListener('settings-updated', handleSettingsUpdate);
    return () => {
      window.removeEventListener('settings-updated', handleSettingsUpdate);
    };
  }, [fetchSettings]);

  return { settings, loading, refetch: fetchSettings };
};
