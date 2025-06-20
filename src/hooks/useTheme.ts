
import { useEffect } from 'react';
import { useSettings } from './useSettings';

export const useTheme = () => {
  const { settings, updateSettings } = useSettings();

  useEffect(() => {
    const applyTheme = () => {
      const root = document.documentElement;
      const theme = settings?.user.theme || 'system';
      
      if (theme === 'system') {
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.classList.toggle('dark', systemPrefersDark);
        root.classList.toggle('light', !systemPrefersDark);
      } else {
        root.classList.toggle('dark', theme === 'dark');
        root.classList.toggle('light', theme === 'light');
      }
    };

    applyTheme();

    // Escuchar cambios en las preferencias del sistema
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = () => {
      if (settings?.user.theme === 'system') {
        applyTheme();
      }
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);

    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, [settings?.user.theme]);

  const setTheme = (theme: 'light' | 'dark' | 'system') => {
    if (settings) {
      updateSettings({
        user: {
          ...settings.user,
          theme
        }
      });
    }
  };

  return {
    theme: settings?.user.theme || 'system',
    setTheme
  };
};
