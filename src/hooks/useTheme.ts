
import { useEffect } from 'react';
import { useSettings } from './useSettings';

export const useTheme = () => {
  const { settings, updateSettings } = useSettings();

  useEffect(() => {
    const applyTheme = () => {
      const root = document.documentElement;
      const body = document.body;
      
      // Aplicar tema claro unificado
      root.classList.remove('dark');
      root.classList.add('light');
      body.classList.remove('dark');
      body.classList.add('light');

      // Variables CSS se toman desde :root en index.css
      // Solo forzar atributos para consistencia
      root.setAttribute('data-theme', 'light');
      body.setAttribute('data-theme', 'light');
      
      // Asegurar fondo base
      body.style.backgroundColor = 'hsl(var(--background))';
      body.style.color = 'hsl(var(--foreground))';
    };

    applyTheme();
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
