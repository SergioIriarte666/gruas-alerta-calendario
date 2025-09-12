
import { useEffect } from 'react';
import { useSettings } from './useSettings';

export const useTheme = () => {
  const { settings, updateSettings } = useSettings();

  useEffect(() => {
    const applyTheme = (theme: 'light' | 'dark' | 'system') => {
      const root = document.documentElement;
      const body = document.body;
      
      let effectiveTheme = theme;
      
      // Detectar preferencia del sistema si es 'system'
      if (theme === 'system') {
        effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      
      // Aplicar tema
      if (effectiveTheme === 'dark') {
        root.classList.remove('light');
        root.classList.add('dark');
        body.classList.remove('light');
        body.classList.add('dark');
        root.setAttribute('data-theme', 'dark');
        body.setAttribute('data-theme', 'dark');
      } else {
        root.classList.remove('dark');
        root.classList.add('light');
        body.classList.remove('dark');
        body.classList.add('light');
        root.setAttribute('data-theme', 'light');
        body.setAttribute('data-theme', 'light');
      }
      
      // Asegurar fondo base
      body.style.backgroundColor = 'hsl(var(--background))';
      body.style.color = 'hsl(var(--foreground))';
    };

    const currentTheme = settings?.user?.theme || 'light';
    applyTheme(currentTheme);
    
    // Escuchar cambios en preferencias del sistema
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (settings?.user?.theme === 'system') {
        applyTheme('system');
      }
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [settings?.user?.theme]);

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
    theme: settings?.user?.theme || 'light',
    setTheme
  };
};
