
import { useState, useEffect } from 'react';
import { Settings, defaultSettings } from '@/types/settings';
import { useSettingsFetcher } from './settings/useSettingsFetcher';
import { useSettingsSaver } from './settings/useSettingsSaver';

export const useSettings = () => {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const { fetchSettings } = useSettingsFetcher();
  const { saveSettings: saveSettingsToDb, saving } = useSettingsSaver();

  const loadSettings = async () => {
    setLoading(true);
    const loadedSettings = await fetchSettings();
    setSettings(loadedSettings);
    setLoading(false);
  };

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    const refetch = () => {
      loadSettings();
    };
    window.addEventListener('settings-updated', refetch);
    return () => {
      window.removeEventListener('settings-updated', refetch);
    };
  }, []);

  const updateSettings = (updates: Partial<Settings>) => {
    setSettings(prev => {
      const merged: Settings = {
        company: updates.company
          ? { ...prev.company, ...updates.company }
          : prev.company,
        user: updates.user
          ? { ...prev.user, ...updates.user }
          : prev.user,
        system: updates.system
          ? { ...prev.system, ...updates.system }
          : prev.system,
        notifications: updates.notifications
          ? { ...prev.notifications, ...updates.notifications }
          : prev.notifications,
      };
      return merged;
    });
  };

  const saveSettings = async () => {
    return await saveSettingsToDb(settings);
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
    localStorage.removeItem('tms-settings');
    localStorage.removeItem('tms-settings-others');
  };

  return {
    settings,
    loading,
    saving,
    updateSettings,
    saveSettings,
    resetSettings
  };
};
