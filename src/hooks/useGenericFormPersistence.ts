
import { useEffect, useCallback, useRef } from 'react';

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

  const saveFormData = useCallback(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(formData));
      console.log(`Form data saved for ${key}:`, formData);
    } catch (error) {
      console.error(`Error saving form data for ${key}:`, error);
    }
  }, [formData, storageKey, key]);

  const loadFormData = useCallback(() => {
    try {
      const savedData = localStorage.getItem(storageKey);
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        console.log(`Loading saved form data for ${key}:`, parsedData);
        setFormData(parsedData);
        return parsedData;
      }
    } catch (error) {
      console.error(`Error loading form data for ${key}:`, error);
      localStorage.removeItem(storageKey);
    }
    return null;
  }, [storageKey, setFormData, key]);

  const clearFormData = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
      console.log(`Form data cleared for ${key}`);
    } catch (error) {
      console.error(`Error clearing form data for ${key}:`, error);
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
    hasPersistedData: () => !!localStorage.getItem(storageKey)
  };
};
