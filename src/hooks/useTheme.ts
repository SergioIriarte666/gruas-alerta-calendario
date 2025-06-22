
import { useEffect, useState } from 'react';
import { useSettings } from './useSettings';

export const useTheme = () => {
  const { settings, updateSettings } = useSettings();
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>('light');

  const applyTheme = (theme: 'light' | 'dark') => {
    const root = document.documentElement;
    const body = document.body;
    
    // Remover clases anteriores
    root.classList.remove('light', 'dark');
    body.classList.remove('light', 'dark');
    
    // Aplicar nuevo tema
    root.classList.add(theme);
    body.classList.add(theme);
    
    if (theme === 'dark') {
      // Variables CSS para tema oscuro
      root.style.setProperty('--background', '15 23 42'); // slate-900
      root.style.setProperty('--foreground', '248 250 252'); // slate-50
      root.style.setProperty('--card', '30 41 59'); // slate-800
      root.style.setProperty('--card-foreground', '248 250 252');
      root.style.setProperty('--popover', '30 41 59');
      root.style.setProperty('--popover-foreground', '248 250 252');
      root.style.setProperty('--primary', '156 250 36'); // Mantener verde TMS
      root.style.setProperty('--primary-foreground', '15 23 42');
      root.style.setProperty('--secondary', '51 65 85'); // slate-700
      root.style.setProperty('--secondary-foreground', '248 250 252');
      root.style.setProperty('--muted', '51 65 85');
      root.style.setProperty('--muted-foreground', '148 163 184'); // slate-400
      root.style.setProperty('--accent', '51 65 85');
      root.style.setProperty('--accent-foreground', '248 250 252');
      root.style.setProperty('--destructive', '239 68 68');
      root.style.setProperty('--destructive-foreground', '248 250 252');
      root.style.setProperty('--border', '51 65 85');
      root.style.setProperty('--input', '30 41 59');
      root.style.setProperty('--ring', '156 250 36');
      
      // Fondo y color del body para tema oscuro
      body.style.backgroundColor = '#0f172a';
      body.style.color = '#f8fafc';
    } else {
      // Variables CSS para tema claro (mantener originales)
      root.style.setProperty('--background', '255 255 255');
      root.style.setProperty('--foreground', '0 0 0');
      root.style.setProperty('--card', '255 255 255');
      root.style.setProperty('--card-foreground', '0 0 0');
      root.style.setProperty('--popover', '255 255 255');
      root.style.setProperty('--popover-foreground', '0 0 0');
      root.style.setProperty('--primary', '156 250 36');
      root.style.setProperty('--primary-foreground', '0 0 0');
      root.style.setProperty('--secondary', '248 250 252');
      root.style.setProperty('--secondary-foreground', '0 0 0');
      root.style.setProperty('--muted', '248 250 252');
      root.style.setProperty('--muted-foreground', '71 85 105');
      root.style.setProperty('--accent', '248 250 252');
      root.style.setProperty('--accent-foreground', '0 0 0');
      root.style.setProperty('--destructive', '239 68 68');
      root.style.setProperty('--destructive-foreground', '255 255 255');
      root.style.setProperty('--border', '226 232 240');
      root.style.setProperty('--input', '255 255 255');
      root.style.setProperty('--ring', '156 250 36');
      
      // Fondo y color del body para tema claro
      body.style.backgroundColor = '#ffffff';
      body.style.color = '#000000';
    }

    // Establecer atributos
    root.setAttribute('data-theme', theme);
    body.setAttribute('data-theme', theme);
    
    setCurrentTheme(theme);
  };

  useEffect(() => {
    // Aplicar tema inicial desde configuración o usar claro por defecto
    const initialTheme = settings?.user?.theme === 'dark' ? 'dark' : 'light';
    applyTheme(initialTheme);
  }, [settings]);

  const setTheme = (theme: 'light' | 'dark') => {
    // Aplicar tema inmediatamente
    applyTheme(theme);
    
    // Guardar en configuración si está disponible
    if (settings) {
      updateSettings({
        user: {
          ...settings.user,
          theme
        }
      });
    }
  };

  const toggleTheme = () => {
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  };

  return {
    theme: currentTheme,
    setTheme,
    toggleTheme
  };
};
