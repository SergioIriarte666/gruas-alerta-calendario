
import { useEffect } from 'react';
import { useSettings } from './useSettings';

/**
 * Hook de tema. Hoy la app es solo claro (Fase 6 del refactor visual
 * añadirá modo oscuro real con tokens semánticos invertidos).
 * El selector de tema en Configuración queda oculto hasta entonces.
 */
export const useTheme = () => {
  const { settings, updateSettings } = useSettings();

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark');
    root.classList.add('light');
    root.setAttribute('data-theme', 'light');
  }, []);

  const setTheme = (_theme: 'light' | 'dark' | 'system') => {
    if (settings) {
      updateSettings({ user: { ...settings.user, theme: 'light' } });
    }
  };

  return { theme: 'light' as const, setTheme };
};
