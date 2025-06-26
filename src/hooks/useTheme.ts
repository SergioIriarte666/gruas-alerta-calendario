
import { useEffect } from 'react';
import { useSettings } from './useSettings';

export const useTheme = () => {
  const { settings, updateSettings } = useSettings();

  useEffect(() => {
    const applyTheme = () => {
      const root = document.documentElement;
      const body = document.body;
      
      // Forzar tema claro siempre
      root.classList.remove('dark');
      root.classList.add('light');
      body.classList.remove('dark');
      body.classList.add('light');

      // Establecer variables CSS para tema claro
      root.style.setProperty('--background', '#ffffff');
      root.style.setProperty('--foreground', '#000000');
      root.style.setProperty('--card', '#ffffff');
      root.style.setProperty('--card-foreground', '#000000');
      root.style.setProperty('--popover', '#ffffff');
      root.style.setProperty('--popover-foreground', '#000000');
      root.style.setProperty('--primary', '#9cfa24');
      root.style.setProperty('--primary-foreground', '#000000');
      root.style.setProperty('--secondary', '#f1f5f9');
      root.style.setProperty('--secondary-foreground', '#000000');
      root.style.setProperty('--muted', '#f1f5f9');
      root.style.setProperty('--muted-foreground', '#64748b');
      root.style.setProperty('--accent', '#f1f5f9');
      root.style.setProperty('--accent-foreground', '#000000');
      root.style.setProperty('--destructive', '#ef4444');
      root.style.setProperty('--destructive-foreground', '#ffffff');
      root.style.setProperty('--border', '#d1d5db');
      root.style.setProperty('--input', '#d1d5db');
      root.style.setProperty('--ring', '#9cfa24');

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
    
    // Asegurar que el fondo sea blanco
    body.style.backgroundColor = '#ffffff';
    body.style.color = '#000000';
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
