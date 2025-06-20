
import { useEffect } from 'react';
import { useSettings } from './useSettings';

export const useTheme = () => {
  const { settings, updateSettings } = useSettings();

  useEffect(() => {
    const applyTheme = () => {
      const root = document.documentElement;
      const body = document.body;
      const theme = settings?.user.theme || 'system';
      
      // Limpiar clases existentes
      root.classList.remove('dark', 'light');
      body.classList.remove('dark', 'light');
      
      if (theme === 'system') {
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const appliedTheme = systemPrefersDark ? 'dark' : 'light';
        root.classList.add(appliedTheme);
        body.classList.add(appliedTheme);
      } else {
        root.classList.add(theme);
        body.classList.add(theme);
      }

      // Forzar actualización del DOM
      root.setAttribute('data-theme', theme);
      body.setAttribute('data-theme', theme);
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

  // Aplicar tema inmediatamente cuando se carga la página
  useEffect(() => {
    const initTheme = () => {
      const root = document.documentElement;
      const body = document.body;
      const savedTheme = settings?.user.theme || 'system';
      
      if (savedTheme === 'system') {
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const appliedTheme = systemPrefersDark ? 'dark' : 'light';
        root.classList.add(appliedTheme);
        body.classList.add(appliedTheme);
      } else {
        root.classList.add(savedTheme);
        body.classList.add(savedTheme);
      }
      
      root.setAttribute('data-theme', savedTheme);
      body.setAttribute('data-theme', savedTheme);
    };

    initTheme();
  }, []);

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
