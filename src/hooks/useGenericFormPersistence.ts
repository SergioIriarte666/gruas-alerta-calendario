
import { useEffect, useCallback, useRef } from 'react';
import { createLogger } from "@/lib/logger";


const logger = createLogger("useGenericFormPersistence");
interface FormPersistenceOptions {
  key: string;
  debounceMs?: number;
  clearOnSuccess?: boolean;
}

export const useGenericFormPersistence = <T extends Record<string, any>>(
  formData: T,
  setFormData: (data: T | ((prev: T) => T)) => void,
  options: FormPersistenceOptions
) => {
  const { key, debounceMs = 1000, clearOnSuccess = true } = options;
  const storageKey = `form-persistence-${key}`;
  const timeoutRef = useRef<NodeJS.Timeout>();
  const initializedRef = useRef(false);
  const skipLoadRef = useRef(false); // Flag para evitar carga después de limpieza

  const saveFormData = useCallback(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(formData));
      logger.debug(`Form data saved for ${key}:`, formData);
    } catch (error) {
      logger.error(`Error saving form data for ${key}:`, error);
    }
  }, [formData, storageKey, key]);

  const loadFormData = useCallback(() => {
    // Si skipLoadRef está activo, no cargar datos
    if (skipLoadRef.current) {
      logger.debug(`Skipping data load for ${key} due to recent clear`);
      skipLoadRef.current = false;
      return null;
    }

    try {
      const savedData = sessionStorage.getItem(storageKey);
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        logger.debug(`Loading saved form data for ${key}:`, parsedData);
        setFormData(parsedData);
        return parsedData;
      }
    } catch (error) {
      logger.error(`Error loading form data for ${key}:`, error);
      sessionStorage.removeItem(storageKey);
    }
    return null;
  }, [storageKey, setFormData, key]);

  const clearFormData = useCallback(() => {
    try {
      sessionStorage.removeItem(storageKey);
      skipLoadRef.current = true; // Activar flag para evitar siguiente carga
      logger.debug(`Form data cleared for ${key}, skip load activated`);
    } catch (error) {
      logger.error(`Error clearing form data for ${key}:`, error);
    }
  }, [storageKey, key]);

  const markAsSubmitted = useCallback(() => {
    if (clearOnSuccess) {
      clearFormData();
    }
  }, [clearFormData, clearOnSuccess]);

  // Load data on mount
  useEffect(() => {
    if (!initializedRef.current) {
      loadFormData();
      initializedRef.current = true;
    }
  }, [loadFormData]);

  // Auto-save with debounce
  useEffect(() => {
    if (!initializedRef.current) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      saveFormData();
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [formData, saveFormData, debounceMs]);

  // Save on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      saveFormData();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        handleBeforeUnload();
      }
    });

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleBeforeUnload);
    };
  }, [saveFormData]);

  return {
    loadFormData,
    saveFormData,
    clearFormData,
    markAsSubmitted,
    hasPersistedData: () => !!sessionStorage.getItem(storageKey)
  };
};
