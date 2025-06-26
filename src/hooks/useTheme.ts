
import { useEffect } from 'react';
import { useSettings } from './useSettings';

export const useTheme = () => {
  const { settings, updateSettings } = useSettings();

  useEffect(() => {
    const applyTheme = () => {
      const root = document.documentElement;
      const body = document.body;
      
      // Aplicar tema oscuro
      root.classList.remove('light');
      root.classList.add('dark');
      body.classList.remove('light');
      body.classList.add('dark');

      // Establecer variables CSS para tema oscuro
      root.style.setProperty('--background', '0 0 0');
      root.style.setProperty('--foreground', '255 255 255');
      root.style.setProperty('--card', '15 23 42');
      root.style.setProperty('--card-foreground', '255 255 255');
      root.style.setProperty('--popover', '15 23 42');
      root.style.setProperty('--popover-foreground', '255 255 255');
      root.style.setProperty('--primary', '156 250 36');
      root.style.setProperty('--primary-foreground', '0 0 0');
      root.style.setProperty('--secondary', '30 41 59');
      root.style.setProperty('--secondary-foreground', '255 255 255');
      root.style.setProperty('--muted', '30 41 59');
      root.style.setProperty('--muted-foreground', '148 163 184');
      root.style.setProperty('--accent', '156 250 36');
      root.style.setProperty('--accent-foreground', '0 0 0');
      root.style.setProperty('--destructive', '239 68 68');
      root.style.setProperty('--destructive-foreground', '255 255 255');
      root.style.setProperty('--border', '51 65 85');
      root.style.setProperty('--input', '30 41 59');
      root.style.setProperty('--ring', '156 250 36');

      // Actualizar el DOM
      root.setAttribute('data-theme', 'dark');
      body.setAttribute('data-theme', 'dark');
    };

    applyTheme();
  }, []);

  // Aplicar tema oscuro desde el inicio
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    
    root.classList.add('dark');
    body.classList.add('dark');
    root.setAttribute('data-theme', 'dark');
    body.setAttribute('data-theme', 'dark');
    
    // Asegurar que el fondo sea negro
    body.style.backgroundColor = '#000000';
    body.style.color = '#ffffff';
  }, []);

  const setTheme = (theme: 'light' | 'dark' | 'system') => {
    // Mantener tema oscuro por defecto
    if (settings) {
      updateSettings({
        user: {
          ...settings.user,
          theme: 'dark'
        }
      });
    }
  };

  return {
    theme: 'dark' as const,
    setTheme
  };
};
