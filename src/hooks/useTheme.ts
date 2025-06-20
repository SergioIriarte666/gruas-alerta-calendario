
import { useEffect } from 'react';
import { useSettings } from './useSettings';

export const useTheme = () => {
  const { settings, updateSettings } = useSettings();

  useEffect(() => {
    const applyTheme = () => {
      const root = document.documentElement;
      const body = document.body;
      
      // Siempre aplicar tema oscuro
      root.classList.remove('light');
      root.classList.add('dark');
      body.classList.remove('light');
      body.classList.add('dark');

      // Forzar actualización del DOM
      root.setAttribute('data-theme', 'dark');
      body.setAttribute('data-theme', 'dark');
    };

    applyTheme();
  }, []);

  // Forzar tema oscuro desde el inicio
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    
    root.classList.add('dark');
    body.classList.add('dark');
    root.setAttribute('data-theme', 'dark');
    body.setAttribute('data-theme', 'dark');
  }, []);

  const setTheme = (theme: 'light' | 'dark' | 'system') => {
    // Mantener siempre oscuro independientemente de la configuración
    if (settings) {
      updateSettings({
        user: {
          ...settings.user,
          theme: 'dark' // Forzar tema oscuro
        }
      });
    }
  };

  return {
    theme: 'dark' as const,
    setTheme
  };
};
