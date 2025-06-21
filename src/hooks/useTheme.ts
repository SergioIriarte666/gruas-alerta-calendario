
import { useEffect } from 'react';
import { useSettings } from './useSettings';

export const useTheme = () => {
  const { settings, updateSettings } = useSettings();

  useEffect(() => {
    const applyTheme = () => {
      const root = document.documentElement;
      const body = document.body;
      
      // Aplicar tema claro
      root.classList.remove('dark');
      root.classList.add('light');
      body.classList.remove('dark');
      body.classList.add('light');

      // Forzar actualización del DOM
      root.setAttribute('data-theme', 'light');
      body.setAttribute('data-theme', 'light');
    };

    applyTheme();
  }, []);

  // Forzar tema claro desde el inicio
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    
    root.classList.add('light');
    body.classList.add('light');
    root.setAttribute('data-theme', 'light');
    body.setAttribute('data-theme', 'light');
  }, []);

  const setTheme = (theme: 'light' | 'dark' | 'system') => {
    // Mantener siempre claro independientemente de la configuración
    if (settings) {
      updateSettings({
        user: {
          ...settings.user,
          theme: 'light' // Forzar tema claro
        }
      });
    }
  };

  return {
    theme: 'light' as const,
    setTheme
  };
};
