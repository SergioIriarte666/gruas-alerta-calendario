import * as React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  defaultAppearancePreferences,
  type AppearancePreferences,
} from '@/types/settings';
import {
  appearancePreferencesFromDatabase,
  appearancePreferencesToDatabase,
  normalizeAppearancePreferences,
} from '@/utils/appearancePreferences';
import { createLogger } from '@/lib/logger';

const logger = createLogger('AppearanceContext');
const STORAGE_PREFIX = 'tms.appearance';
const SAVE_DELAY_MS = 450;

type SyncStatus = 'loading' | 'saved' | 'saving' | 'local-only' | 'error';

interface AppearanceContextValue {
  preferences: AppearancePreferences;
  syncStatus: SyncStatus;
  syncError: string | null;
  updatePreferences: (updates: Partial<AppearancePreferences>) => void;
  resetPreferences: () => void;
}

const AppearanceContext = React.createContext<AppearanceContextValue | undefined>(undefined);

const getStorageKey = (userId?: string | null) => `${STORAGE_PREFIX}.${userId || 'device'}`;

const readLocalPreferences = (userId?: string | null): AppearancePreferences | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    return raw ? normalizeAppearancePreferences(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
};

const readLegacyThemePreferences = (): AppearancePreferences | null => {
  if (typeof window === 'undefined') return null;
  try {
    const theme = localStorage.getItem('tms.theme');
    return theme === 'light' || theme === 'dark' || theme === 'system'
      ? normalizeAppearancePreferences({ theme })
      : null;
  } catch {
    return null;
  }
};

const writeLocalPreferences = (userId: string | null | undefined, preferences: AppearancePreferences) => {
  try {
    const payload = JSON.stringify(preferences);
    localStorage.setItem(getStorageKey(userId), payload);
    // Espejo sin usuario: lo lee el script de pre-pintado de index.html, que
    // corre antes de conocer la sesión. Mantenerlo siempre al día es lo que
    // evita el flash de apariencia anterior en un F5.
    localStorage.setItem(getStorageKey(null), payload);
  } catch {
    // La preferencia sigue activa durante la sesión aunque el navegador bloquee storage.
  }
};

const applyDocumentPreferences = (preferences: AppearancePreferences) => {
  const root = document.documentElement;
  root.dataset.density = preferences.density;
  root.dataset.textScale = String(preferences.textScale);
  root.classList.toggle('reduce-motion', preferences.reduceMotion);
};

export const AppearanceProvider = ({ children }: { children: React.ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const { setTheme } = useTheme();
  const [preferences, setPreferences] = React.useState<AppearancePreferences>(() =>
    readLocalPreferences(null) ?? readLegacyThemePreferences() ?? defaultAppearancePreferences,
  );
  const [syncStatus, setSyncStatus] = React.useState<SyncStatus>('loading');
  const [syncError, setSyncError] = React.useState<string | null>(null);
  const saveTimerRef = React.useRef<number | null>(null);
  const loadSequenceRef = React.useRef(0);
  const saveSequenceRef = React.useRef(0);
  const preferencesRef = React.useRef(preferences);

  const applyPreferences = React.useCallback((next: AppearancePreferences) => {
    preferencesRef.current = next;
    setPreferences(next);
    setTheme(next.theme);
    applyDocumentPreferences(next);
  }, [setTheme]);

  React.useEffect(() => {
    applyDocumentPreferences(preferences);
  }, [preferences]);

  React.useEffect(() => {
    if (authLoading) return;

    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    saveSequenceRef.current += 1;
    const sequence = ++loadSequenceRef.current;
    const local = readLocalPreferences(user?.id) ?? readLocalPreferences(null) ?? readLegacyThemePreferences();
    const initial = local ?? defaultAppearancePreferences;
    applyPreferences(initial);
    setSyncError(null);

    if (!user?.id) {
      setSyncStatus('local-only');
      return;
    }

    setSyncStatus('loading');
    void (async () => {
      const { data, error } = await supabase
        .from('user_settings')
        .select('theme, interface_density, text_scale, reduce_motion, sidebar_collapsed')
        .eq('user_id', user.id)
        .maybeSingle();

      if (sequence !== loadSequenceRef.current) return;

      if (error) {
        logger.warn('No se pudieron cargar preferencias visuales remotas; se usará el respaldo local.', error);
        setSyncStatus('local-only');
        setSyncError('Las preferencias se están guardando solo en este equipo.');
        return;
      }

      if (data) {
        const remote = appearancePreferencesFromDatabase(data);
        applyPreferences(remote);
        writeLocalPreferences(user.id, remote);
      }
      setSyncStatus('saved');
    })();
  }, [applyPreferences, authLoading, user?.id]);

  React.useEffect(() => () => {
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
  }, []);

  const persistPreferences = React.useCallback((next: AppearancePreferences) => {
    writeLocalPreferences(user?.id, next);

    if (!user?.id) {
      setSyncStatus('local-only');
      return;
    }

    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    const saveSequence = ++saveSequenceRef.current;
    setSyncStatus('saving');
    setSyncError(null);
    saveTimerRef.current = window.setTimeout(() => {
      void (async () => {
        const { error } = await supabase
          .from('user_settings')
          .upsert({
            user_id: user.id,
            ...appearancePreferencesToDatabase(next),
          }, { onConflict: 'user_id' });

        if (saveSequence !== saveSequenceRef.current) return;

        if (error) {
          logger.warn('No se pudieron sincronizar preferencias visuales.', error);
          setSyncStatus('error');
          setSyncError('No se pudo sincronizar. El ajuste quedó guardado en este equipo.');
          return;
        }

        setSyncStatus('saved');
      })();
    }, SAVE_DELAY_MS);
  }, [user?.id]);

  const updatePreferences = React.useCallback((updates: Partial<AppearancePreferences>) => {
    const next = normalizeAppearancePreferences({ ...preferencesRef.current, ...updates });
    applyPreferences(next);
    persistPreferences(next);
  }, [applyPreferences, persistPreferences]);

  const resetPreferences = React.useCallback(() => {
    const next = { ...defaultAppearancePreferences };
    applyPreferences(next);
    persistPreferences(next);
  }, [applyPreferences, persistPreferences]);

  const value = React.useMemo<AppearanceContextValue>(() => ({
    preferences,
    syncStatus,
    syncError,
    updatePreferences,
    resetPreferences,
  }), [preferences, resetPreferences, syncError, syncStatus, updatePreferences]);

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
};

export const useAppearance = () => {
  const context = React.useContext(AppearanceContext);
  if (!context) throw new Error('useAppearance debe usarse dentro de AppearanceProvider');
  return context;
};
