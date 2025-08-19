import { useState, useEffect } from 'react';
import { UserSettings, UserDatabaseSettings } from '@/types/settings';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useUserSettings = () => {
  const [userSettings, setUserSettings] = useState<UserSettings>({
    language: 'es',
    theme: 'system',
    timezone: 'America/Santiago',
    useSystemTimezone: true,
    notifications: true,
    dateFormat: 'DD/MM/YYYY',
    currency: 'CLP',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchUserSettings = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching user settings:', error);
        toast.error('Error al cargar configuraciones del usuario');
        return;
      }

      if (data) {
        setUserSettings({
          language: data.language as 'es' | 'en',
          theme: 'system', // Por ahora mantenemos el theme en localStorage
          timezone: data.timezone,
          useSystemTimezone: data.use_system_timezone,
          notifications: true, // Por ahora mantenemos notificaciones en localStorage
          dateFormat: data.date_format as 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD',
          currency: data.currency as 'CLP' | 'USD' | 'EUR',
        });
      }
    } catch (error) {
      console.error('Error fetching user settings:', error);
      toast.error('Error al cargar configuraciones del usuario');
    } finally {
      setLoading(false);
    }
  };

  const saveUserSettings = async (settings: Partial<UserSettings>) => {
    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error('Usuario no autenticado');
        return false;
      }

      const dbSettings: UserDatabaseSettings = {
        timezone: settings.timezone || userSettings.timezone,
        use_system_timezone: settings.useSystemTimezone ?? userSettings.useSystemTimezone,
        date_format: settings.dateFormat || userSettings.dateFormat,
        language: settings.language || userSettings.language,
        currency: settings.currency || userSettings.currency,
      };

      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          ...dbSettings,
        });

      if (error) {
        console.error('Error saving user settings:', error);
        toast.error('Error al guardar configuraciones');
        return false;
      }

      // Actualizar estado local
      setUserSettings(prev => ({ ...prev, ...settings }));
      
      // Invalidar cache de timezone utils y currency utils
      const { invalidateUserSettingsCache } = await import('@/utils/timezoneUtils');
      const { invalidateUserCurrencyCache } = await import('@/utils/currencyUtils');
      invalidateUserSettingsCache();
      invalidateUserCurrencyCache();
      
      // Disparar evento para que otros componentes se actualicen
      window.dispatchEvent(new CustomEvent('user-settings-updated', { 
        detail: { ...userSettings, ...settings } 
      }));
      
      toast.success('Configuraciones guardadas exitosamente');
      return true;
    } catch (error) {
      console.error('Error saving user settings:', error);
      toast.error('Error al guardar configuraciones');
      return false;
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchUserSettings();
  }, []);

  // Escuchar cambios desde otros lugares
  useEffect(() => {
    const handleRefresh = () => {
      fetchUserSettings();
    };
    
    window.addEventListener('user-settings-updated', handleRefresh);
    return () => {
      window.removeEventListener('user-settings-updated', handleRefresh);
    };
  }, []);

  return {
    userSettings,
    loading,
    saving,
    saveUserSettings,
    refetch: fetchUserSettings
  };
};