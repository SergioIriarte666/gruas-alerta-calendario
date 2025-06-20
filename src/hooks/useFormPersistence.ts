
import { useEffect, useCallback } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { InspectionFormValues } from '@/schemas/inspectionSchema';

export const useFormPersistence = (
  form: UseFormReturn<InspectionFormValues>,
  serviceId: string
) => {
  const storageKey = `inspection-form-${serviceId}`;

  const saveFormData = useCallback(() => {
    try {
      const formData = form.getValues();
      localStorage.setItem(storageKey, JSON.stringify(formData));
      console.log('Form data saved to localStorage:', formData);
    } catch (error) {
      console.error('Error saving form data:', error);
    }
  }, [form, storageKey]);

  const loadFormData = useCallback(() => {
    try {
      const savedData = localStorage.getItem(storageKey);
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        console.log('Loading saved form data:', parsedData);
        
        // Restaurar cada campo individualmente
        Object.keys(parsedData).forEach((key) => {
          if (parsedData[key] !== undefined && parsedData[key] !== null) {
            form.setValue(key as keyof InspectionFormValues, parsedData[key]);
          }
        });
        
        return parsedData;
      }
    } catch (error) {
      console.error('Error parsing saved form data:', error);
      localStorage.removeItem(storageKey);
    }
    return null;
  }, [form, storageKey]);

  const clearFormData = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
      console.log('Form data cleared from localStorage');
    } catch (error) {
      console.error('Error clearing form data:', error);
    }
  }, [storageKey]);

  // Auto-save en cambios del formulario con debounce
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const subscription = form.watch(() => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        saveFormData();
      }, 1000); // Debounce de 1 segundo
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeoutId);
    };
  }, [form, saveFormData]);

  // Cargar datos al montar el componente
  useEffect(() => {
    loadFormData();
  }, [loadFormData]);

  // Limpiar al desmontar si el formulario se envió correctamente
  useEffect(() => {
    return () => {
      // Solo limpiar si el formulario está en un estado válido y completo
      const formState = form.formState;
      if (formState.isSubmitSuccessful) {
        clearFormData();
      }
    };
  }, [form.formState.isSubmitSuccessful, clearFormData]);

  return {
    loadFormData,
    saveFormData,
    clearFormData
  };
};
